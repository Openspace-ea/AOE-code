/**
 * 发射轨迹 2D 曲线（高度 - 射程）
 *
 * Canvas 自绘，零依赖：横轴射程 km、纵轴高度 km，自动缩放；
 * 画目标轨道高度参考线与当前位置点。
 * 自适应容器尺寸 + devicePixelRatio，不模糊。
 */

import { useEffect, useRef } from 'react'

import type { SeparationEvent } from '@gnc/core'

export interface TrajectoryPoint {
  /** 射程 km */
  downrange: number
  /** 高度 km */
  altitude: number
}

interface TrajectoryCanvasProps {
  points: TrajectoryPoint[]
  /** 目标轨道高度 km（参考线） */
  targetOrbitKm: number
  /** 是否已入轨（显示入轨标记） */
  reachedOrbit?: boolean
  /** 分离事件（在曲线上标记） */
  separationEvents?: SeparationEvent[]
}

/** 计算美观的标尺间隔：将 max 分成约 targetTicks 段，间隔取 1/2/5 序列 */
function niceStep(max: number, targetTicks: number): number {
  if (max <= 0) return 1
  const rough = max / targetTicks
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / pow
  let nice
  if (norm <= 1.5) nice = 1
  else if (norm <= 3.5) nice = 2
  else if (norm <= 7.5) nice = 5
  else nice = 10
  return nice * pow
}

export default function TrajectoryCanvas({ points, targetOrbitKm, reachedOrbit, separationEvents }: TrajectoryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const W = Math.round(rect.width * dpr)
      const H = Math.round(rect.height * dpr)
      if (W < 10 || H < 10) return

      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)

      const cssW = rect.width
      const cssH = rect.height
      const PAD = { left: 48, right: 16, top: 16, bottom: 32 }
      const plotW = cssW - PAD.left - PAD.right
      const plotH = cssH - PAD.top - PAD.bottom

      const maxAlt = Math.max(targetOrbitKm * 1.3, ...points.map((p) => p.altitude), 100)
      // X 轴范围：跟随数据 + 20% 余量，最小 500km
      const dataMaxRange = points.length > 0 ? Math.max(...points.map((p) => p.downrange)) : 0
      const maxRange = Math.max(dataMaxRange * 1.2, 500)
      const px = (d: number) => PAD.left + (d / maxRange) * plotW
      const py = (a: number) => PAD.top + plotH - (a / maxAlt) * plotH

      // 背景
      ctx.fillStyle = 'rgba(5, 10, 22, 0.9)'
      ctx.fillRect(0, 0, cssW, cssH)

      // 网格与坐标标注
      ctx.strokeStyle = 'rgba(96, 140, 210, 0.15)'
      ctx.fillStyle = 'rgba(148, 163, 196, 0.9)'
      ctx.font = '10px sans-serif'
      ctx.lineWidth = 0.5
      // Y 轴：固定约 5 格
      const altStep = niceStep(maxAlt, 5)
      for (let a = 0; a <= maxAlt; a += altStep) {
        ctx.beginPath()
        ctx.moveTo(PAD.left, py(a))
        ctx.lineTo(cssW - PAD.right, py(a))
        ctx.stroke()
        const altLabel = a >= 1000 ? `${(a / 1000).toFixed(1)}k` : `${Math.round(a)}`
        ctx.fillText(altLabel, 8, py(a) + 3)
      }
      // X 轴：固定 6 个标尺，自适应数值
      const rangeStep = niceStep(maxRange, 6)
      for (let d = 0; d <= maxRange; d += rangeStep) {
        const labelX = px(d)
        if (labelX > cssW - PAD.right + 5) break
        ctx.beginPath()
        ctx.moveTo(labelX, PAD.top)
        ctx.lineTo(labelX, cssH - PAD.bottom)
        ctx.stroke()
        const label = d >= 1000 ? `${(d / 1000).toFixed(1)}k` : `${Math.round(d)}`
        ctx.fillText(label, labelX - 8, cssH - 12)
      }
      ctx.fillText('高度 km', 8, PAD.top - 4)
      ctx.fillText('射程 km', cssW - PAD.right - 44, cssH - 12)

      // 目标轨道高度参考线
      ctx.strokeStyle = 'rgba(58, 224, 216, 0.45)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(PAD.left, py(targetOrbitKm))
      ctx.lineTo(cssW - PAD.right, py(targetOrbitKm))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(58, 224, 216, 0.8)'
      ctx.fillText(`目标轨道 ${targetOrbitKm} km`, PAD.left + 8, py(targetOrbitKm) - 4)

      // 地面
      ctx.strokeStyle = 'rgba(232, 238, 252, 0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD.left, py(0))
      ctx.lineTo(cssW - PAD.right, py(0))
      ctx.stroke()

      // 轨迹
      if (points.length > 1) {
        ctx.strokeStyle = '#4da6ff'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(px(p.downrange), py(p.altitude))
          else ctx.lineTo(px(p.downrange), py(p.altitude))
        })
        ctx.stroke()

        // 当前位置
        const last = points[points.length - 1]
        ctx.fillStyle = '#3ae0d8'
        ctx.beginPath()
        ctx.arc(px(last.downrange), py(last.altitude), 3.5, 0, Math.PI * 2)
        ctx.fill()

        // 入轨标记
        if (reachedOrbit) {
          const markerX = px(last.downrange)
          const markerY = py(last.altitude)
          // 绿色圆环
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(markerX, markerY, 8, 0, Math.PI * 2)
          ctx.stroke()
          // 文字标签
          ctx.fillStyle = '#22c55e'
          ctx.font = 'bold 11px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('✓ 入轨成功', markerX, markerY - 14)
          ctx.textAlign = 'left'
        }

        // 分离事件标记
        if (separationEvents && separationEvents.length > 0) {
          separationEvents.forEach((evt) => {
            // 轨迹点按 0.5s 采样，找分离时刻对应的点
            const idx = Math.round(evt.time / 0.5)
            const pt = points[Math.min(idx, points.length - 1)]
            if (!pt) return
            const sx = px(pt.downrange)
            const sy = py(pt.altitude)
            // 虚线竖线
            ctx.strokeStyle = 'rgba(255, 146, 43, 0.7)'
            ctx.lineWidth = 1.2
            ctx.setLineDash([4, 3])
            ctx.beginPath()
            ctx.moveTo(sx, PAD.top)
            ctx.lineTo(sx, cssH - PAD.bottom)
            ctx.stroke()
            ctx.setLineDash([])
            // 标记点
            ctx.fillStyle = '#ff922b'
            ctx.beginPath()
            ctx.arc(sx, sy, 5, 0, Math.PI * 2)
            ctx.fill()
            // 标签
            ctx.fillStyle = '#ff922b'
            ctx.font = 'bold 10px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(evt.label, sx, PAD.top + 12)
            ctx.textAlign = 'left'
          })
        }
      }
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [points, targetOrbitKm, reachedOrbit, separationEvents])

  return <canvas ref={canvasRef} className="launch-trajectory" />
}
