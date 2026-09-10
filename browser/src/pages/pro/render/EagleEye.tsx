/**
 * 鹰眼图（2D 世界地图小窗）—— 设计定位为 Map2D 的缩略模式
 *
 * 当前为 Canvas 自绘实现（与 R3F Map2D 同为等距圆柱投影）：经纬网格 +
 * 陆地轮廓（可选，world-atlas TopoJSON 运行时加载，失败则仅网格）+
 * 已启用分组的星下点分布 + 主视口中心十字。点击任意位置，主视图切换为 2D
 * 并定位至对应经纬度。支持大/小两种尺寸（右上角按钮切换，localStorage
 * 持久化，默认小图）。
 *
 * S1 为纯上提（自 orbit/EagleEye.tsx），未改实现：改写为复用 R3F Map2D
 * 渲染路径会改变陆廓/网格观感且需另行回归验证，留待后续任务（设计文档 §4）。
 */

import { useEffect, useRef, useState } from 'react'

/**
 * 鹰眼点位：最小经纬结构（render 底座不依赖场景 services；
 * 调用方可传入附加字段更宽的对象，结构兼容即可）
 */
export interface EagleEyeDot {
  noradId: string
  group: string
  latDeg: number
  lonDeg: number
}

interface EagleEyeProps {
  dots: EagleEyeDot[]
  groupColors: Record<string, string>
  selectedNoradId?: string
  /** 主视口中心 */
  viewCenter?: { latDeg: number; lonDeg: number } | null
  onJump: (latDeg: number, lonDeg: number) => void
}

const SIZES = {
  small: { width: 150, height: 75, dot: 1.2 },
  large: { width: 260, height: 130, dot: 1.5 },
} as const

type SizeKey = keyof typeof SIZES

const SIZE_STORAGE_KEY = 'aoe_eagle_size'

/** 陆地轮廓（GeoJSON features），模块级缓存，加载失败保持 null */
let landFeatures: any[] | null = null
let landLoading: Promise<any[] | null> | null = null

function loadLand(): Promise<any[] | null> {
  if (landFeatures) return Promise.resolve(landFeatures)
  if (landLoading) return landLoading
  landLoading = Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((r) => {
      if (!r.ok) throw new Error(`world-atlas ${r.status}`)
      return r.json()
    }),
    import('topojson-client'),
  ])
    .then(([atlas, topojson]) => {
      const geo = topojson.feature(atlas, atlas.objects.countries) as any
      landFeatures = geo.features ?? []
      return landFeatures
    })
    .catch(() => null)
  return landLoading
}

function project(lonDeg: number, latDeg: number, w: number, h: number): [number, number] {
  return [((lonDeg + 180) / 360) * w, ((90 - latDeg) / 180) * h]
}

/** 经纬度折线按 180° 经线断裂（避免跨日界连线） */
function drawPath(ctx: CanvasRenderingContext2D, coords: number[][], w: number, h: number) {
  let prev: [number, number] | null = null
  for (const [lon, lat] of coords) {
    const [x, y] = project(lon, lat, w, h)
    if (prev && Math.abs(x - prev[0]) > w / 2) {
      ctx.moveTo(x, y)
    } else if (!prev) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    prev = [x, y]
  }
}

export default function EagleEye({
  dots,
  groupColors,
  selectedNoradId,
  viewCenter,
  onJump,
}: EagleEyeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const landRef = useRef<any[] | null>(landFeatures)
  const [sizeKey, setSizeKey] = useState<SizeKey>(() =>
    localStorage.getItem(SIZE_STORAGE_KEY) === 'large' ? 'large' : 'small',
  )

  const { width: W, height: H, dot: dotRadius } = SIZES[sizeKey]

  const toggleSize = () => {
    const next: SizeKey = sizeKey === 'small' ? 'large' : 'small'
    setSizeKey(next)
    localStorage.setItem(SIZE_STORAGE_KEY, next)
  }

  // 首次挂载时尝试加载陆地轮廓，完成后触发一次重绘
  useEffect(() => {
    if (landRef.current) return
    loadLand().then((features) => {
      landRef.current = features
      draw()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 数据/尺寸变化时重绘（父组件节流控制频率）
  useEffect(draw)

  function draw() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    // 背景
    ctx.fillStyle = 'rgba(5, 10, 22, 0.92)'
    ctx.fillRect(0, 0, W, H)

    // 经纬网格（30°）
    ctx.strokeStyle = 'rgba(96, 140, 210, 0.15)'
    ctx.lineWidth = 0.5
    for (let lon = -150; lon <= 150; lon += 30) {
      const [x] = project(lon, 0, W, H)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const [, y] = project(0, lat, W, H)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // 陆地轮廓
    if (landRef.current) {
      ctx.fillStyle = 'rgba(96, 140, 210, 0.14)'
      for (const feature of landRef.current) {
        const geom = feature.geometry
        const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
        ctx.beginPath()
        for (const polygon of polygons) {
          for (const ring of polygon) {
            drawPath(ctx, ring, W, H)
            ctx.closePath()
          }
        }
        ctx.fill()
      }
    }

    // 卫星星下点
    for (const dot of dots) {
      const [x, y] = project(dot.lonDeg, dot.latDeg, W, H)
      ctx.fillStyle = groupColors[dot.group] ?? '#4da6ff'
      ctx.beginPath()
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    // 选中目标高亮
    const selected = dots.find((d) => d.noradId === selectedNoradId)
    if (selected) {
      const [x, y] = project(selected.lonDeg, selected.latDeg, W, H)
      ctx.strokeStyle = '#3ae0d8'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 主视口中心十字
    if (viewCenter) {
      const [x, y] = project(viewCenter.lonDeg, viewCenter.latDeg, W, H)
      ctx.strokeStyle = 'rgba(232, 238, 252, 0.8)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x - 6, y)
      ctx.lineTo(x + 6, y)
      ctx.moveTo(x, y - 6)
      ctx.lineTo(x, y + 6)
      ctx.stroke()
    }
  }

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * W
    const y = ((event.clientY - rect.top) / rect.height) * H
    const lonDeg = (x / W) * 360 - 180
    const latDeg = 90 - (y / H) * 180
    onJump(Math.max(-90, Math.min(90, latDeg)), Math.max(-180, Math.min(180, lonDeg)))
  }

  return (
    <div className="eagle-eye">
      <canvas
        ref={canvasRef}
        className="eagle-eye__canvas"
        width={W}
        height={H}
        onClick={handleClick}
        title="点击定位到对应位置"
      />
      <button
        className="eagle-eye__size-toggle"
        onClick={toggleSize}
        title={sizeKey === 'small' ? '放大鹰眼图' : '缩小鹰眼图'}
      >
        {sizeKey === 'small' ? '＋' : '－'}
      </button>
    </div>
  )
}
