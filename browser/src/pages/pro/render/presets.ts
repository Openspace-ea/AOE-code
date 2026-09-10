/**
 * 星球预设：参数化天体（CelestialBody）的配置单点定义
 *
 * 本期只实装地球；火星/月球为接口示意（贴图待配，注释标「预留」）。
 * 换星球只需换参数（半径/贴图/大气），渲染代码零改动。
 * 底图纹理选择（如地球的卫星影像/地图）是预设内的纹理列表，
 * 由壳层底图菜单展示；底座不碰 DOM。
 */

import { EARTH_TEXTURE_OFFSET_Y } from './coords'

/** 参数化天体配置（对应 CelestialBody 的渲染参数） */
export interface CelestialBodyPreset {
  /** 半径（km），场景比例 1 单位 = 1000 km */
  radiusKm: number
  /** 表面贴图 URL（默认底图） */
  dayTexture: string
  /** 贴图经度校准（弧度，mesh.rotation.y）：换贴图偏转时只改这里 */
  textureOffsetY: number
  /** 大气辉光（颜色 + 厚度，厚度为半径比例）：无大气星球为 null */
  atmosphere: { color: string; thickness: number } | null
  /** 可选底图纹理列表（键 → 贴图 URL；支持本地单张纹理与 tiles: 瓦片源，见 tileStitch.ts） */
  basemaps: Record<string, string>
}

/** 地球底图纹理键（业务层按底图选择索引 EARTH_PRESET.basemaps） */
export type EarthTextureKey = 'tex-day' | 'tex-map'

export const EARTH_PRESET: CelestialBodyPreset = {
  radiusKm: 6371,
  dayTexture: 'tiles:/basemap/esri-imagery@3', // 卫星影像（本地 Esri z0-3 瓦片）
  textureOffsetY: EARTH_TEXTURE_OFFSET_Y, // 校准说明见 coords.ts（当前贴图天然对齐，为 0）
  atmosphere: { color: '#4da6ff', thickness: 0.022 }, // 蓝白辉光
  basemaps: {
    'tex-day': 'tiles:/basemap/esri-imagery@3', // 卫星影像（本地 Esri z0-3 瓦片）
    'tex-map': 'tiles:/basemap/amap@3', // 高德地图（中文标签，本地 z0-3）
  },
}

/**
 * 各底图的高清细节在线源（拉近时按视野区域拼接，见 TileDetailLayer/tileStitch）：
 * 浏览器直连第三方，不经后端；均已验证返回 ACAO:*（跨域进 WebGL 纹理的硬条件）。
 * null 表示该底图无高清源（拉多近都用基础纹理）。
 */
export const BASEMAP_DETAIL_SOURCES: Record<EarthTextureKey, string | null> = {
  'tex-day': 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', // Esri 卫星影像（z4+）
  'tex-map': 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', // 高德地图（中文标签，z4+）
}

/** 预留：火星（贴图待配；稀薄大气暂按无大气，可配淡粉辉光） */
export const MARS_PRESET: CelestialBodyPreset = {
  radiusKm: 3389.5,
  dayTexture: '', // 待配贴图
  textureOffsetY: 0,
  atmosphere: null,
  basemaps: {},
}

/** 预留：月球（潮汐锁定，贴图待配） */
export const MOON_PRESET: CelestialBodyPreset = {
  radiusKm: 1737.4,
  dayTexture: '', // 待配贴图
  textureOffsetY: 0,
  atmosphere: null,
  basemaps: {},
}
