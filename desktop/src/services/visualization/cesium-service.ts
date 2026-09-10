/**
 * Cesium 3D 可视化服务
 *
 * 在 AOE Desktop 中渲染 3D 地球和轨道
 * 用户看到的是 AOE 的界面，不是 STK
 */

export interface CesiumConfig {
  cesiumIonToken: string
  container: HTMLElement
}

export interface SatelliteEntity {
  id: string
  name: string
  noradId: string
  positions: {
    time: Date
    x: number
    y: number
    z: number
  }[]
  orbitType: string
  color: string
}

export interface GroundStationEntity {
  id: string
  name: string
  latitude: number
  longitude: number
  altitude: number
}

export interface AccessArc {
  satelliteId: string
  groundStationId: string
  start: Date
  stop: Date
  color: string
}

/**
 * Cesium 可视化服务
 */
export class CesiumVisualization {
  private viewer: any = null
  private entities: Map<string, any> = new Map()
  private config: CesiumConfig

  constructor(config: CesiumConfig) {
    this.config = config
  }

  /**
   * 初始化 Cesium 视图
   */
  async initialize(): Promise<boolean> {
    try {
      // 动态加载 Cesium
      const Cesium = await this.loadCesium()

      // 设置 Token
      Cesium.Ion.defaultAccessToken = this.config.cesiumIonToken

      // 创建视图
      this.viewer = new Cesium.Viewer(this.config.container, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        vrButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        // 使用暗色主题
        skyAtmosphere: undefined,
        skyBox: undefined,
      })

      // 设置视角
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(104.0, 35.0, 10000000),
        orientation: {
          heading: 0,
          pitch: -Math.PI / 2,
          roll: 0
        }
      })

      return true
    } catch (err) {
      console.error('Cesium 初始化失败:', err)
      return false
    }
  }

  /**
   * 动态加载 Cesium
   */
  private async loadCesium(): Promise<any> {
    // 检查是否已加载
    if ((window as any).Cesium) {
      return (window as any).Cesium
    }

    // 动态加载
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.107/Build/Cesium/Cesium.js'
      script.onload = () => resolve((window as any).Cesium)
      script.onerror = reject
      document.head.appendChild(script)

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.107/Build/Cesium/Widgets/widgets.css'
      document.head.appendChild(link)
    })
  }

  /**
   * 添加卫星
   */
  addSatellite(satellite: SatelliteEntity): void {
    if (!this.viewer) return

    const Cesium = (window as any).Cesium

    // 创建轨道路径
    const positions = satellite.positions.map(p =>
      Cesium.Cartesian3.fromElements(p.x * 1000, p.y * 1000, p.z * 1000)
    )

    // 添加卫星实体
    const entity = this.viewer.entities.add({
      id: `sat-${satellite.id}`,
      name: satellite.name,
      // 卫星模型（使用点代替）
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString(satellite.color || '#00ff00'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      },
      // 轨道路径
      path: {
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.fromCssColorString(satellite.color || '#00ff00')
        }),
        width: 3,
        leadTime: 0,
        trailTime: 60 * 60 * 24  // 24 小时轨迹
      },
      // 标签
      label: {
        text: satellite.name,
        font: '14px sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20)
      },
      // 位置（使用 SampledPositionProperty 模拟运动）
      position: this.createSampledPosition(satellite.positions)
    })

    this.entities.set(`sat-${satellite.id}`, entity)
  }

  /**
   * 创建采样位置（用于动画）
   */
  private createSampledPosition(positions: any[]): any {
    const Cesium = (window as any).Cesium
    const positionProperty = new Cesium.SampledPositionProperty()

    for (const pos of positions) {
      const time = Cesium.JulianDate.fromDate(pos.time)
      const position = Cesium.Cartesian3.fromElements(
        pos.x * 1000,
        pos.y * 1000,
        pos.z * 1000
      )
      positionProperty.addSample(time, position)
    }

    return positionProperty
  }

  /**
   * 添加地面站
   */
  addGroundStation(station: GroundStationEntity): void {
    if (!this.viewer) return

    const Cesium = (window as any).Cesium

    const entity = this.viewer.entities.add({
      id: `gs-${station.id}`,
      name: station.name,
      position: Cesium.Cartesian3.fromDegrees(
        station.longitude,
        station.latitude,
        station.altitude * 1000
      ),
      point: {
        pixelSize: 12,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: station.name,
        font: '14px sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20)
      }
    })

    this.entities.set(`gs-${station.id}`, entity)
  }

  /**
   * 添加可见性弧线
   */
  addAccessArc(arc: AccessArc): void {
    if (!this.viewer) return

    const Cesium = (window as any).Cesium

    const satEntity = this.entities.get(`sat-${arc.satelliteId}`)
    const gsEntity = this.entities.get(`gs-${arc.groundStationId}`)

    if (!satEntity || !gsEntity) return

    // 创建可见性弧线
    const entity = this.viewer.entities.add({
      id: `access-${arc.satelliteId}-${arc.groundStationId}-${arc.start.getTime()}`,
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const satPos = satEntity.position?.getValue(this.viewer.clock.currentTime)
          const gsPos = gsEntity.position?.getValue(this.viewer.clock.currentTime)
          if (satPos && gsPos) {
            return [satPos, gsPos]
          }
          return []
        }, false),
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.fromCssColorString(arc.color || '#ffff00')
        })
      }
    })

    this.entities.set(`access-${entity.id}`, entity)
  }

  /**
   * 飞到卫星
   */
  flyToSatellite(satelliteId: string): void {
    const entity = this.entities.get(`sat-${satelliteId}`)
    if (entity && this.viewer) {
      this.viewer.flyTo(entity, { duration: 2 })
    }
  }

  /**
   * 飞到地面站
   */
  flyToGroundStation(stationId: string): void {
    const entity = this.entities.get(`gs-${stationId}`)
    if (entity && this.viewer) {
      this.viewer.flyTo(entity, { duration: 2 })
    }
  }

  /**
   * 设置时间范围
   */
  setTimeRange(start: Date, stop: Date): void {
    if (!this.viewer) return

    const Cesium = (window as any).Cesium
    this.viewer.clock.startTime = Cesium.JulianDate.fromDate(start)
    this.viewer.clock.stopTime = Cesium.JulianDate.fromDate(stop)
    this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(start)
    this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
  }

  /**
   * 设置时间速度
   */
  setTimeSpeed(multiplier: number): void {
    if (this.viewer) {
      this.viewer.clock.multiplier = multiplier
    }
  }

  /**
   * 清除所有实体
   */
  clearAll(): void {
    if (this.viewer) {
      this.viewer.entities.removeAll()
      this.entities.clear()
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.viewer) {
      this.viewer.destroy()
      this.viewer = null
    }
  }
}

export default CesiumVisualization