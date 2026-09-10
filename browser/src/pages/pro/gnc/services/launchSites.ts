/**
 * 发射站注册表（AOE 编目系统发射站代码对照表，共 41 个）
 *
 * 坐标与代码口径以 `AOECode/docs/发射站参照表.md`（2026-08-18，GCAT 数据源）
 * 为准；空域/海域/移动平台类为代表性参考点。UNK（未知）与 SUBL（潜艇平台，
 * 无固定坐标）不参与选择。
 */

export interface LaunchSite {
  /** 发射站代码（AOE 编目 launch_site 参数口径） */
  code: string
  /** 中文名称 */
  name: string
  /** 国家/地区 */
  country: string
  latDeg: number
  lonDeg: number
  /** 是否可选（UNK=未知，不可选） */
  selectable: boolean
}

export const LAUNCH_SITES: LaunchSite[] = [
  { code: 'AFETR', name: '空军东部试验场（卡纳维拉尔角）', country: '美国', latDeg: 28.46, lonDeg: -80.54, selectable: true },
  { code: 'AFWTR', name: '空军西部试验场（范登堡）', country: '美国', latDeg: 34.75, lonDeg: -120.62, selectable: true },
  { code: 'ANDSP', name: '安多亚航天港', country: '挪威', latDeg: 69.2943, lonDeg: 16.0207, selectable: true },
  { code: 'ALCLC', name: '阿尔坎塔拉发射中心', country: '巴西', latDeg: -2.317, lonDeg: -44.3671, selectable: true },
  { code: 'BOS', name: '鲍文轨道航天港', country: '澳大利亚', latDeg: -19.9582, lonDeg: 148.1136, selectable: true },
  { code: 'CAS', name: '加那利空域', country: '西班牙', latDeg: 27.92, lonDeg: -15.32, selectable: true },
  { code: 'DLS', name: '东巴罗夫斯克发射场', country: '俄罗斯', latDeg: 50.766, lonDeg: 59.544, selectable: true },
  { code: 'ERAS', name: '东部试验场空域', country: '美国', latDeg: 28.5, lonDeg: -80.54, selectable: true },
  { code: 'FRGUI', name: '欧洲航天港（库鲁）', country: '法国', latDeg: 5.2333, lonDeg: -52.7517, selectable: true },
  { code: 'HGSTR', name: '哈马吉尔航天跟踪场', country: '阿尔及利亚', latDeg: 30.887, lonDeg: -3.083, selectable: true },
  { code: 'JJSLA', name: '济州岛海上发射区', country: '韩国', latDeg: 33.2, lonDeg: 126.4, selectable: true },
  { code: 'JSC', name: '酒泉卫星发射中心', country: '中国', latDeg: 40.958, lonDeg: 100.292, selectable: true },
  { code: 'KODAK', name: '科迪亚克发射场', country: '美国', latDeg: 57.4359, lonDeg: -152.3378, selectable: true },
  { code: 'KSCUT', name: '内之浦航天中心', country: '日本', latDeg: 31.25, lonDeg: 131.079, selectable: true },
  { code: 'KWAJ', name: '夸贾林环礁', country: '美国', latDeg: 8.9917, lonDeg: 167.72, selectable: true },
  { code: 'KYMSC', name: '卡普斯京亚尔导弹与航天中心', country: '俄罗斯', latDeg: 48.5, lonDeg: 45.8, selectable: true },
  { code: 'NSC', name: '罗老航天中心', country: '韩国', latDeg: 34.4318, lonDeg: 127.5363, selectable: true },
  { code: 'PLMSC', name: '普列谢茨克导弹与航天中心', country: '俄罗斯', latDeg: 62.93, lonDeg: 40.58, selectable: true },
  { code: 'RLLB', name: '火箭实验室发射基地（马希亚）', country: '新西兰', latDeg: -39.2609, lonDeg: 177.8655, selectable: true },
  { code: 'SCSLA', name: '南海发射区', country: '中国', latDeg: 21.1, lonDeg: 114.2, selectable: true },
  { code: 'SEAL', name: '海上发射平台（移动式，名义赤道）', country: '国际', latDeg: 0.0, lonDeg: -154.0, selectable: true },
  { code: 'SEMLS', name: '塞姆南卫星发射场', country: '伊朗', latDeg: 35.2347, lonDeg: 53.921, selectable: true },
  { code: 'SMTS', name: '沙赫鲁德导弹试验场', country: '伊朗', latDeg: 36.23, lonDeg: 55.33, selectable: true },
  { code: 'SNMLP', name: '圣马可发射平台', country: '肯尼亚', latDeg: -2.9408, lonDeg: 40.2134, selectable: true },
  { code: 'SPKII', name: '纪伊航天港', country: '日本', latDeg: 33.5443, lonDeg: 135.8895, selectable: true },
  { code: 'SRILR', name: '萨迪什·达万航天中心', country: '印度', latDeg: 13.621, lonDeg: 80.303, selectable: true },
  { code: 'SUBL', name: '潜艇发射平台（移动式，无固定坐标）', country: '国际', latDeg: 0, lonDeg: 0, selectable: false },
  { code: 'SVOBO', name: '斯沃博德内发射场', country: '俄罗斯', latDeg: 51.79, lonDeg: 128.19, selectable: true },
  { code: 'TAISC', name: '太原卫星发射中心', country: '中国', latDeg: 38.849, lonDeg: 111.608, selectable: true },
  { code: 'TANSC', name: '种子岛航天中心', country: '日本', latDeg: 30.4, lonDeg: 130.97, selectable: true },
  { code: 'TYMSC', name: '拜科努尔航天发射场', country: '哈萨克斯坦', latDeg: 45.97, lonDeg: 63.3, selectable: true },
  { code: 'UNK', name: '未知', country: '-', latDeg: 0, lonDeg: 0, selectable: false },
  { code: 'VOSTO', name: '东方航天发射场', country: '俄罗斯', latDeg: 51.88, lonDeg: 128.33, selectable: true },
  { code: 'WLPIS', name: '沃洛普斯岛', country: '美国', latDeg: 37.9383, lonDeg: -75.4633, selectable: true },
  { code: 'WOMRA', name: '伍默拉', country: '澳大利亚', latDeg: -30.925, lonDeg: 136.5, selectable: true },
  { code: 'WRAS', name: '西部试验场空域', country: '美国', latDeg: 34.75, lonDeg: -120.62, selectable: true },
  { code: 'WSC', name: '文昌卫星发射中心', country: '中国', latDeg: 19.6142, lonDeg: 110.9511, selectable: true },
  { code: 'XICLF', name: '西昌卫星发射中心', country: '中国', latDeg: 28.2472, lonDeg: 102.0291, selectable: true },
  { code: 'YAVNE', name: '亚夫内发射设施', country: '以色列', latDeg: 31.9, lonDeg: 34.7, selectable: true },
  { code: 'YSLA', name: '黄海发射区', country: '中国', latDeg: 35.0, lonDeg: 123.0, selectable: true },
  { code: 'YUN', name: '云岘发射场（西海卫星发射场）', country: '朝鲜', latDeg: 39.66, lonDeg: 124.706, selectable: true },
]

/** 默认发射场：卡纳维拉尔角（与历史仿真配置一致） */
export const DEFAULT_SITE_CODE = 'AFETR'

export function getLaunchSite(code: string): LaunchSite | undefined {
  return LAUNCH_SITES.find((s) => s.code === code)
}
