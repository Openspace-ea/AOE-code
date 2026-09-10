/**
 * SSA 全量 TLE 目录数据源（自有站点 https://ssa.aseem.cn/TLE.json，每日更新）
 *
 * 与旧 CelesTrak 分组接口的差异：该接口返回全量目录（约 3.2 万个目标、8MB JSON），
 * 星座分组在前端按名称规则筛选（GROUP_RULES，仅取 PAYLOAD，排除碎片/箭体），
 * 分组 key 与 groups.ts 的 ORBIT_GROUPS 一一对应，可按用户操作任意增删。
 *
 * 三级回退：实时拉取（服务器 Cache-Control max-age=86400，浏览器 HTTP 缓存同日去重）
 * → Cache Storage 灾难缓存（8MB 超 localStorage 配额，故用 caches API，仅断网时用）
 * → 内置快照（snapshot/，覆盖 stations/beidou/galileo）。
 * 会话内模块缓存 TTL 2 小时，避免每开一次分组重拉重解析 3 万条记录。
 *
 * 部署要求：站点必须配置 CORS 响应头（Access-Control-Allow-Origin），
 * 否则浏览器拦截跨域读取，会静默落到灾难缓存/快照。
 */

import type { SatelliteTle } from './types'
import { parseTleText, type GroupFetchResult } from './tle'
import { getSnapshot, SNAPSHOT_DATE } from './snapshot'

const CATALOG_URL = import.meta.env.VITE_TLE_DATA_URL || 'https://ssa.aseem.cn/TLE.json'
/** 同源代理兜底通道（dev 走 vite.config.ts 的 /tle-proxy；生产需等效 nginx 反代。
 *  ssa.aseem.cn 配好 ACAO 头后直连通道自动生效，本通道仅作过渡） */
const CATALOG_PROXY_URL = import.meta.env.VITE_TLE_PROXY_URL || '/tle-proxy/TLE.json'
const CACHE_NAME = 'aoe-tle-catalog-v1'
// 会话内缓存 12 小时：进入轨道模式预热一次，之后所有分组筛选都读内存；
// 页面刷新/重开走浏览器 HTTP 缓存（服务端 max-age=86400），跨天才真正回源
const MEM_CACHE_TTL_MS = 12 * 60 * 60 * 1000

/** 全量目录的单条记录（接口原始字段） */
interface CatalogRecord {
  INTLDES: string
  TLE_LINE1: string
  TLE_LINE2: string
  OBJECT_NAME: string
  OBJECT_TYPE: string
}

interface Catalog {
  records: CatalogRecord[]
  fetchedAt: number
  /** true 表示来自 Cache Storage 灾难缓存（非实时） */
  stale: boolean
}

/**
 * 星座分组筛选规则。
 * 星座类（stations/starlink 等）按名称正则 + OBJECT_TYPE === 'PAYLOAD' 匹配；
 * 残骸类（rocket_body/debris）只按 OBJECT_TYPE 匹配，不过滤名称。
 * 规则按 ssa.aseem.cn/TLE.json 实际数据校准（2026-08-17 样本 32309 条）：
 * stations 8 / starlink 10967 / beidou 53 / gps 73 / glonass 143 /
 * galileo 32 / iridium 106 / oneweb 654 / rocket_body ~1000+ / debris ~10000+。
 */
const GROUP_RULES: Record<string, (name: string, type: string) => boolean> = {
  // 注意词边界：AISSAT / SWISSCUBE / MISSION 等均含 "ISS" 子串
  stations: (n, t) => t === 'PAYLOAD' && /^(ISS|CSS) \(|^(TIANHE|WENTIAN|MENGTIAN|XUNTIAN|TIANGONG)/.test(n),
  starlink: (n, t) => t === 'PAYLOAD' && /^STARLINK/.test(n),
  beidou: (n, t) => t === 'PAYLOAD' && /^BEIDOU/.test(n),
  gps: (n, t) => t === 'PAYLOAD' && /^(GPS|NAVSTAR)\b/.test(n),
  glonass: (n, t) => t === 'PAYLOAD' && /GLONASS|URAGAN/.test(n),
  galileo: (n, t) => t === 'PAYLOAD' && /^GALILEO/.test(n),
  iridium: (n, t) => t === 'PAYLOAD' && /^IRIDIUM/.test(n),
  oneweb: (n, t) => t === 'PAYLOAD' && /^ONEWEB/.test(n),
  // 残骸类：按目标类型直接匹配
  rocket_body: (_n, t) => t === 'ROCKET BODY',
  debris: (_n, t) => t === 'DEBRIS',
}

// ---------- 目录加载（模块缓存 + 在途去重 + Cache Storage 灾难缓存） ----------

let catalogCache: Catalog | null = null
let catalogPromise: Promise<Catalog> | null = null

async function writeOfflineCache(records: CatalogRecord[], fetchedAt: number): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(
      CATALOG_URL,
      new Response(JSON.stringify({ savedAt: fetchedAt, records })),
    )
  } catch {
    // caches API 不可用（隐私模式等）时静默跳过，仅少一层兜底
  }
}

async function readOfflineCache(): Promise<Catalog | null> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const res = await cache.match(CATALOG_URL)
    if (!res) return null
    const data = (await res.json()) as { savedAt: number; records: CatalogRecord[] }
    return { records: data.records, fetchedAt: data.savedAt, stale: true }
  } catch {
    return null
  }
}

/** 响应 → 目录（含灾难缓存写入）；解析失败视为该通道不可用 */
async function catalogFromResponse(res: Response): Promise<Catalog> {
  const records = (await res.json()) as CatalogRecord[]
  const catalog: Catalog = {
    records,
    fetchedAt: Date.parse(res.headers.get('date') ?? '') || Date.now(),
    stale: false,
  }
  writeOfflineCache(records, catalog.fetchedAt)
  return catalog
}

async function loadCatalog(): Promise<Catalog> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < MEM_CACHE_TTL_MS) {
    return catalogCache
  }
  if (!catalogPromise) {
    catalogPromise = (async () => {
      // 通道 1：浏览器直连（需 ssa.aseem.cn 配 ACAO 头；HEAD 探测先行，
      // CORS 未放行时响应头到达即失败，不白等 8MB 全量下载）
      try {
        const head = await fetch(CATALOG_URL, { method: 'HEAD' })
        if (head.ok) {
          const res = await fetch(CATALOG_URL)
          if (res.ok) return await catalogFromResponse(res)
        }
      } catch {
        // CORS 拦截/网络失败：落到代理通道
      }
      // 通道 2：同源代理（dev vite proxy / 生产 nginx 反代）
      try {
        const res = await fetch(CATALOG_PROXY_URL)
        if (res.ok) return await catalogFromResponse(res)
        throw new Error(`TLE 代理通道返回 ${res.status}`)
      } catch (error) {
        // 双通道均失败：回退 Cache Storage 灾难缓存
        const offline = await readOfflineCache()
        if (offline) return offline
        throw error instanceof Error ? error : new Error('TLE 目录拉取失败')
      }
    })()
    try {
      catalogCache = await catalogPromise
    } finally {
      catalogPromise = null
    }
  }
  return catalogPromise ? catalogPromise! : catalogCache!
}

// ---------- 对外：按分组拉取 ----------

/** 进入轨道模式即预热目录（fire-and-forget）：后续分组筛选直接读内存缓存 */
export function prefetchCatalog(): void {
  loadCatalog().catch(() => {})
}

function toSatelliteTle(r: CatalogRecord, group: string): SatelliteTle {
  return {
    noradId: r.TLE_LINE1.substring(2, 7).trim(),
    name: r.OBJECT_NAME || `NORAD ${r.TLE_LINE1.substring(2, 7).trim()}`,
    intlDes: r.INTLDES,
    group,
    tleLine1: r.TLE_LINE1,
    tleLine2: r.TLE_LINE2,
    objectType: r.OBJECT_TYPE,
  }
}

// ---------- 对外：关键词搜索（供测控仿真等场景复用） ----------

/** 卫星搜索结果条目 */
export interface CatalogSatellite {
  name: string
  line1: string
  line2: string
  objectType: string
}

/**
 * 按关键词搜索全量目录（前端匹配 OBJECT_NAME）
 * 复用目录模块缓存，不会重复拉取
 */
export async function searchCatalog(keyword: string, maxResults = 20): Promise<CatalogSatellite[]> {
  const catalog = await loadCatalog()
  const kw = keyword.toUpperCase()
  return catalog.records
    .filter((r) => (r.OBJECT_NAME ?? '').toUpperCase().includes(kw))
    .slice(0, maxResults)
    .map((r) => ({
      name: r.OBJECT_NAME || `NORAD ${r.TLE_LINE1.substring(2, 7).trim()}`,
      line1: r.TLE_LINE1,
      line2: r.TLE_LINE2,
      objectType: r.OBJECT_TYPE,
    }))
}

/**
 * 拉取一个分组的 TLE 数据（全量目录前端筛选，带灾难缓存与快照回退）
 */
export async function fetchGroup(group: string): Promise<GroupFetchResult> {
  const rule = GROUP_RULES[group]
  try {
    if (!rule) throw new Error(`未知星座分组：${group}`)
    const catalog = await loadCatalog()
    const satellites = catalog.records
      .filter((r) => rule(r.OBJECT_NAME ?? '', r.OBJECT_TYPE))
      .map((r) => toSatelliteTle(r, group))
    return { satellites, fetchedAt: catalog.fetchedAt, stale: catalog.stale }
  } catch (error) {
    // 目录整体不可用：回退内置快照（仅 stations/beidou/galileo 有快照）
    const snapshot = getSnapshot(group)
    if (snapshot) {
      return {
        satellites: parseTleText(snapshot, group),
        fetchedAt: Date.parse(SNAPSHOT_DATE),
        stale: true,
        snapshot: true,
      }
    }
    throw error instanceof Error ? error : new Error('轨道数据拉取失败')
  }
}
