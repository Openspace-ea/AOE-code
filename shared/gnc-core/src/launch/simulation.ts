import { MU_EARTH } from '../math/constants'
import { EARTH_RADIUS, STANDARD_GRAVITY } from '../math/physics'
import { State6, Vec3 } from '../orbits/twobody'
import {
  computeAtmosphere,
  computeDrag,
  determineLaunchPhase,
  GravityTurnGuidance,
  LaunchPhase,
  LaunchState,
  LaunchVehicle
} from './guidance'

function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function scale(v: Vec3, s: number): Vec3 { return [v[0] * s, v[1] * s, v[2] * s] }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function norm(v: Vec3): number { return Math.hypot(v[0], v[1], v[2]) }
function unit(v: Vec3): Vec3 { const n = norm(v) || 1; return [v[0] / n, v[1] / n, v[2] / n] }

function gravityAccel(r: Vec3): Vec3 {
  const rmag = norm(r)
  const factor = -MU_EARTH / (rmag * rmag * rmag)
  return scale(r, factor)
}

function thrustVector(thrustMag: number, pitch: number, yaw: number, r: Vec3): Vec3 {
  // 推力方向基于当前位置的局部坐标系：r_hat = 径向向外（"上"）
  // pitch = 90° → 径向向外；pitch = 0° → 局部水平
  // yaw → 水平面内旋转（发射方位角）
  const r_hat = unit(r)

  // 构造局部水平坐标系（east / north）
  const ref: Vec3 = Math.abs(r_hat[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  const east_raw: Vec3 = [
    ref[1] * r_hat[2] - ref[2] * r_hat[1],
    ref[2] * r_hat[0] - ref[0] * r_hat[2],
    ref[0] * r_hat[1] - ref[1] * r_hat[0],
  ]
  const east_hat = unit(east_raw)
  const north_hat: Vec3 = [
    r_hat[1] * east_hat[2] - r_hat[2] * east_hat[1],
    r_hat[2] * east_hat[0] - r_hat[0] * east_hat[2],
    r_hat[0] * east_hat[1] - r_hat[1] * east_hat[0],
  ]

  const horizontal = add(scale(east_hat, Math.cos(yaw)), scale(north_hat, Math.sin(yaw)))
  const dir = add(scale(r_hat, Math.sin(pitch)), scale(horizontal, Math.cos(pitch)))
  return scale(unit(dir), thrustMag)
}

function getActiveStage(vehicle: LaunchVehicle, t: number): {
  thrustVac: number,
  isp: number,
  massPropellant: number,
  which: 1 | 2
} {
  if (t < vehicle.stage1.burn_time) {
    return { thrustVac: vehicle.stage1.thrust, isp: vehicle.stage1.isp, massPropellant: vehicle.stage1.mass_propellant, which: 1 }
  }
  return { thrustVac: vehicle.stage2.thrust, isp: vehicle.stage2.isp, massPropellant: vehicle.stage2.mass_propellant, which: 2 }
}

export interface SeparationEvent {
  time: number
  altitude: number
  label: string
  /** 抛掉的质量 kg */
  jettisonedMass: number
}

export function integrateLaunchTrajectory(
  prev: LaunchState,
  vehicle: LaunchVehicle,
  guidance: GravityTurnGuidance,
  dt: number
): LaunchState & { separationEvent?: SeparationEvent } {
  const t = prev.mission_time + dt

  // Geometry and kinematics
  const rmag = norm(prev.r)
  const altitude = Math.max(0, rmag - EARTH_RADIUS)

  // Atmosphere and drag
  const atmosphere = computeAtmosphere(altitude)

  // Guidance
  const { pitch, yaw, throttle } = guidance.computeGuidance(prev)

  // Stage selection and thrust
  const { thrustVac, isp, which } = getActiveStage(vehicle, prev.mission_time)

  // 分离事件检测：跨过 stage1.burn_time 时抛掉 SRB 干重
  let separationEvent: SeparationEvent | undefined
  let mass = prev.mass
  const stage1End = vehicle.stage1.burn_time
  if (prev.mission_time < stage1End && t >= stage1End) {
    // SRB 分离：抛掉 stage1 干重中超出 stage2 干重的部分
    const jettisoned = vehicle.stage1.mass_dry - vehicle.stage2.mass_dry
    if (jettisoned > 0) {
      mass -= jettisoned
      separationEvent = {
        time: stage1End,
        altitude,
        label: 'SRB 分离',
        jettisonedMass: jettisoned,
      }
    }
  }

  // 燃料耗尽检查
  const stage2End = stage1End + vehicle.stage2.burn_time
  const hasFuel = (which === 1 && prev.mission_time < stage1End) ||
                  (which === 2 && prev.mission_time >= stage1End && prev.mission_time < stage2End)
  const thrustMag = hasFuel ? throttle * thrustVac : 0

  // 推力方向基于当前位置的局部径向
  const thrust = thrustVector(thrustMag, pitch, yaw, prev.r)

  // Drag opposes velocity
  const drag = computeDrag(prev.v, atmosphere)

  // Mass flow (only when burning and has fuel)
  if (hasFuel) {
    const mdot = thrustMag / (isp * STANDARD_GRAVITY)
    const massFloor = vehicle.payload_mass + (which === 1 ? vehicle.stage1.mass_dry : vehicle.stage2.mass_dry)
    mass = Math.max(massFloor, mass - mdot * dt)
  }

  // Acceleration
  const a_grav = gravityAccel(prev.r)
  const a_thrust = scale(thrust, 1 / Math.max(mass, 1))
  const a_drag = scale(drag, 1 / Math.max(mass, 1))
  const accel = add(add(a_grav, a_thrust), a_drag)

  // Integrate (semi-implicit Euler)
  let v: Vec3 = add(prev.v, scale(accel, dt))
  let r: Vec3 = add(prev.r, scale(v, dt))

  // 防止穿地：如果位置低于地球表面，钳制到表面并清除径向内速度
  const rMag = norm(r)
  if (rMag < EARTH_RADIUS) {
    const rUnit = unit(r)
    r = scale(rUnit, EARTH_RADIUS)
    // 清除径向内速度分量
    const vRadial = dot(v, rUnit)
    if (vRadial < 0) {
      v = sub(v, scale(rUnit, vRadial))
    }
  }

  // Recompute scalars
  const newRmag = norm(r)
  const newAlt = Math.max(0, newRmag - EARTH_RADIUS)
  const newVmag = norm(v)

  // Flight path angle relative to local horizontal
  const radialUnit = unit(r)
  const vRadial = (v[0] * radialUnit[0] + v[1] * radialUnit[1] + v[2] * radialUnit[2])
  const gamma = Math.asin(Math.max(-1, Math.min(1, vRadial / (newVmag || 1))))

  const phase = determineLaunchPhase(t, newAlt, newVmag)

  const next: LaunchState & { separationEvent?: SeparationEvent } = {
    r,
    v,
    phase,
    mission_time: t,
    altitude: newAlt,
    velocity_magnitude: newVmag,
    flight_path_angle: gamma,
    heading: prev.heading, // unchanged in this simple model
    mass,
    thrust,
    drag,
    atmosphere,
    guidance: {
      pitch_program: pitch,
      yaw_program: yaw,
      throttle
    },
    separationEvent,
  }

  return next
}

// Convenience to initialize a reasonable state from just position/velocity
export function initializeLaunchState(state: State6, vehicle: LaunchVehicle): LaunchState {
  const rmag = norm(state.r)
  const atmosphere = computeAtmosphere(Math.max(0, rmag - EARTH_RADIUS))
  const vmag = norm(state.v)
  return {
    r: state.r,
    v: state.v,
    phase: LaunchPhase.PRELAUNCH,
    mission_time: 0,
    altitude: Math.max(0, rmag - EARTH_RADIUS),
    velocity_magnitude: vmag,
    flight_path_angle: Math.PI / 2,
    heading: 0,
    mass: vehicle.stage1.mass_dry + vehicle.stage1.mass_propellant + vehicle.stage2.mass_dry + vehicle.stage2.mass_propellant + vehicle.payload_mass + vehicle.fairing_mass,
    thrust: [0, 0, 0],
    drag: [0, 0, 0],
    atmosphere,
    guidance: { pitch_program: Math.PI / 2, yaw_program: 0, throttle: 0 }
  }
}
