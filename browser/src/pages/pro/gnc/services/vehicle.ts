/**
 * 发射场景数据适配（双级 + 分离事件）
 *
 * - stage1 = 2×SRB + 芯级并行段（0–126s）
 * - stage2 = 芯级单独段（126–395s），SRB 干重在 126s 分离时抛掉
 * 注：简化制导模型的重力损耗比真实 SLS 大，推进剂按 15% 余量配置以确保入轨
 */

import type { LaunchVehicle } from '@gnc/core'

/** SRB 干重（2×98t）：stage1→stage2 分离时抛掉 */
export const SRB_DRY_MASS = 196000

export const SLS_LAUNCH_VEHICLE: LaunchVehicle = {
  stage1: {
    mass_dry: 281000, // 2×SRB 98t + 芯级 85t（分离前总干重）
    mass_propellant: 1760000,
    thrust: 36.84e6,
    isp: 269,
    burn_time: 126,
  },
  stage2: {
    mass_dry: 85000, // 芯级干重（SRB 分离后保留）
    mass_propellant: 700000, // +15% 余量，补偿简化制导的重力损耗
    thrust: 8.8e6,
    isp: 452,
    burn_time: 352, // 700t / (8.8e6/(452*9.81)) ≈ 352s
  },
  payload_mass: 26520,
  fairing_mass: 0,
}
