/**
 * XYZ 瓦片 → 等距圆柱整图纹理（运行时一次性拼接，结果进 loadTexture 模块缓存）
 *
 * 背景：3D 球体 / 2D 平面都只吃单张等距圆柱（equirect）纹理，而地图底图是
 * 标准 slippy map 瓦片（Web 墨卡托）。本模块在运行时把瓦片源拼成一张
 * 等距圆柱 CanvasTexture，上游（CelestialBody / Map2D）零改动。
 *
 * 地址约定：`tiles:<源>@<层级>`，源支持两种形式：
 * - 模板：含 {z}/{x}/{y} 占位符，如 Esri 的 `https://…/tile/{z}/{y}/{x}`；
 * - 目录：按 `<源>/<z>/<x>/<y>.png` 取值，如本地 `/basemap/carto-voyager`。
 * 拼接只用指定层级（取最高可用层级，细节最丰富）。
 *
 * 在线源要求：必须返回 CORS 响应头（Access-Control-Allow-Origin），跨域图片
 * 以 crossOrigin=anonymous 加载——否则画布被污染、无法作为 WebGL 纹理上传。
 * 已验证可用源（2026-08-17）：CARTO dark_all、Esri World_Imagery（均 ACAO:*）。
 *
 * 容错：单瓦片失败重试一次，仍失败则填深色块（网络抖动不致命）；
 * 失败率超 25% 判定为源整体不可用，reject 交由上层提示。
 *
 * 投影换算：两种投影的 x 轴都是经度（线性对齐，无需横向重采样），
 * 只需逐行做 墨卡托纬度 → 等距圆柱纬度 的重投影；瓦片只覆盖 ±85.05°，
 * 极区超出部分钳制到边缘行（暗色地图底下极区拉伸肉眼不可辨）。
 */

import * as THREE from 'three'

const TILE_SIZE = 256
/** 输出等距圆柱纹理尺寸（宽取 z4 墨卡托整图宽度 4096，纵向重采样不损失横向细节） */
const OUT_W = 4096
const OUT_H = 2048
/** 缺块填充色（与深空底色一致） */
const FALLBACK_COLOR = '#0b1220'

function loadImage(src: string, retries = 1): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // 跨域瓦片必须 CORS 洁净（跨域读取需对方站点 ACAO 头），本地相对路径不用设
    if (/^https?:\/\//.test(src)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => {
      if (retries > 0) {
        resolve(loadImage(src, retries - 1))
      } else {
        reject(new Error(`瓦片加载失败：${src}`))
      }
    }
    img.src = src
  })
}

/** 由源（模板或目录）生成瓦片 URL */
function tileUrl(source: string, z: number, x: number, y: number): string {
  return source.includes('{z}')
    ? source.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
    : `${source}/${z}/${x}/${y}.png`
}

/** 墨卡托归一化 y（0..1，顶为 0）→ 纬度（度） */
function mercYNormToLat(t: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * t))) * 180) / Math.PI
}

/** 纬度（度）→ 墨卡托归一化 y（0..1） */
export function latToMercYNorm(latDeg: number): number {
  const lat = (latDeg * Math.PI) / 180
  return (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2
}

/** 解析 `tiles:<源>@<层级>` 并拼接为等距圆柱纹理 */
export async function loadTiledEquirectTexture(spec: string): Promise<THREE.Texture> {
  const m = /^tiles:(.+)@(\d+)$/.exec(spec)
  if (!m) {
    throw new Error(`瓦片纹理地址格式错误：${spec}（应为 tiles:<源>@<层级>）`)
  }
  const [, source, zoomStr] = m
  const zoom = Number.parseInt(zoomStr, 10)
  const n = 2 ** zoom
  const size = n * TILE_SIZE

  // 并行加载全部瓦片：单块失败重试一次后记为 null（容错），不拖垮整图
  const images = await Promise.all(
    Array.from({ length: n * n }, (_, i) =>
      loadImage(tileUrl(source, zoom, i % n, Math.floor(i / n))).catch(() => null),
    ),
  )
  const failed = images.filter((img) => img === null).length
  if (failed > images.length * 0.25) {
    throw new Error(`瓦片源不可用（${failed}/${images.length} 块加载失败）：${source}`)
  }

  // 1) 拼接 Web 墨卡托整图
  const merc = document.createElement('canvas')
  merc.width = size
  merc.height = size
  const mctx = merc.getContext('2d')!
  mctx.fillStyle = FALLBACK_COLOR
  mctx.fillRect(0, 0, size, size)
  images.forEach((img, i) => {
    if (img) mctx.drawImage(img, (i % n) * TILE_SIZE, Math.floor(i / n) * TILE_SIZE)
  })

  // 2) 逐行重投影为等距圆柱（y 轴：墨卡托纬度 → 线性纬度）
  const out = document.createElement('canvas')
  out.width = OUT_W
  out.height = OUT_H
  const octx = out.getContext('2d')!
  for (let j = 0; j < OUT_H; j++) {
    const lat = Math.PI / 2 - (Math.PI * (j + 0.5)) / OUT_H
    const srcY = Math.min(size - 1, Math.max(0, latToMercYNorm((lat * 180) / Math.PI) * size))
    octx.drawImage(merc, 0, srcY, size, 1, 0, j, OUT_W, 1)
  }

  const tex = new THREE.CanvasTexture(out)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 区域纹理：高清 LOD 补丁的几何覆盖范围（经纬度边界） */
export interface RegionalTexture {
  texture: THREE.Texture
  lonMin: number
  lonMax: number
  latMin: number
  latMax: number
}

/**
 * 按瓦片范围拼接区域纹理（TileDetailLayer 拉近地球时调用）。
 * 与全球拼接同一套 墨卡托→等距圆柱 重投影，但只覆盖 [x0..x1]×[y0..y1] 的瓦片窗口；
 * 返回的经纬边界为瓦片窗口的精确覆盖范围（供补丁几何对齐用）。
 */
export async function loadRegionalTexture(
  source: string,
  zoom: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Promise<RegionalTexture> {
  const maxIdx = 2 ** zoom - 1
  const cx0 = Math.max(0, Math.min(x0, maxIdx))
  const cy0 = Math.max(0, Math.min(y0, maxIdx))
  const cx1 = Math.max(cx0, Math.min(x1, maxIdx))
  const cy1 = Math.max(cy0, Math.min(y1, maxIdx))
  const cols = cx1 - cx0 + 1
  const rows = cy1 - cy0 + 1
  const globalSize = 2 ** zoom * TILE_SIZE

  const images = await Promise.all(
    Array.from({ length: cols * rows }, (_, i) =>
      loadImage(tileUrl(source, zoom, cx0 + (i % cols), cy0 + Math.floor(i / cols))).catch(
        () => null,
      ),
    ),
  )
  const failed = images.filter((img) => img === null).length
  if (failed > images.length * 0.25) {
    throw new Error(`瓦片源不可用（${failed}/${images.length} 块加载失败）：${source}`)
  }

  const w = cols * TILE_SIZE
  const h = rows * TILE_SIZE
  const merc = document.createElement('canvas')
  merc.width = w
  merc.height = h
  const mctx = merc.getContext('2d')!
  mctx.fillStyle = FALLBACK_COLOR
  mctx.fillRect(0, 0, w, h)
  images.forEach((img, i) => {
    if (img) mctx.drawImage(img, (i % cols) * TILE_SIZE, Math.floor(i / cols) * TILE_SIZE)
  })

  // 瓦片窗口的精确经纬边界
  const n = 2 ** zoom
  const lonMin = (cx0 / n) * 360 - 180
  const lonMax = ((cx1 + 1) / n) * 360 - 180
  const latMax = mercYNormToLat(cy0 / n) // 顶行（北）
  const latMin = mercYNormToLat((cy1 + 1) / n) // 底行（南）

  // 区域内逐行重投影为等距圆柱
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')!
  for (let j = 0; j < h; j++) {
    const lat = latMax - ((j + 0.5) / h) * (latMax - latMin)
    const srcY = Math.min(h - 1, Math.max(0, latToMercYNorm(lat) * globalSize - cy0 * TILE_SIZE))
    octx.drawImage(merc, 0, srcY, w, 1, 0, j, w, 1)
  }

  const tex = new THREE.CanvasTexture(out)
  tex.colorSpace = THREE.SRGBColorSpace
  return { texture: tex, lonMin, lonMax, latMin, latMax }
}
