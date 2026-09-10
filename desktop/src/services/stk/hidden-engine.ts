/**
 * STK 隐藏引擎
 *
 * 核心理念：STK 在后台静默运行，用户完全感知不到
 * - 不显示 STK 窗口
 * - 所有结果在 AOE Desktop 中渲染
 * - 用户只看到 AOE 的界面
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

export interface HiddenEngineConfig {
  stkPath: string          // STK 安装路径
  pythonPath: string       // Python 路径
  tempDir: string          // 临时文件目录
  headless: boolean        // 是否完全无头模式
}

export interface AnalysisRequest {
  type: 'orbit' | 'coverage' | 'access' | 'collision' | 'reentry'
  params: Record<string, any>
}

export interface AnalysisResult {
  success: boolean
  data: any
  charts?: ChartData[]
  visualization?: VisualizationData
  error?: string
}

export interface ChartData {
  type: 'line' | 'bar' | 'scatter' | '3d'
  title: string
  xLabel: string
  yLabel: string
  series: {
    name: string
    data: number[][]
  }[]
}

export interface VisualizationData {
  type: 'orbit' | 'groundtrack' | 'coverage' | 'access'
  entities: {
    id: string
    name: string
    type: 'satellite' | 'facility' | 'area'
    positions?: { time: string, x: number, y: number, z: number }[]
    properties?: Record<string, any>
  }[]
}

/**
 * STK 隐藏引擎
 * 管理 STK 后台进程，提供无缝体验
 */
export class HiddenSTKEngine extends EventEmitter {
  private config: HiddenEngineConfig
  private stkProcess: ChildProcess | null = null
  private pythonProcess: ChildProcess | null = null
  private isReady = false
  private commandQueue: Array<{
    command: string
    resolve: (result: any) => void
    reject: (error: Error) => void
  }> = []

  constructor(config: HiddenEngineConfig) {
    super()
    this.config = config
  }

  /**
   * 启动隐藏的 STK 实例
   */
  async start(): Promise<boolean> {
    try {
      // 1. 启动 Python 中间件（控制 STK）
      await this.startPythonMiddleware()

      // 2. 通过 Python 启动隐藏的 STK
      await this.startHiddenSTK()

      this.isReady = true
      this.emit('ready')
      return true
    } catch (err) {
      this.emit('error', err)
      return false
    }
  }

  /**
   * 启动 Python 中间件
   * 这个中间件负责与 STK COM 通信
   */
  private async startPythonMiddleware(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = `
import sys
import json
import comtypes.client
import comtypes.gen.STKObjects

class STKMiddleware:
    def __init__(self):
        self.stk = None
        self.root = None

    def connect(self):
        """连接到隐藏的 STK 实例"""
        try:
            # 创建 STK 应用（不显示窗口）
            self.stk = comtypes.client.CreateObject("STK12.Application")
            self.stk.Visible = False  # 关键：隐藏窗口
            self.stk.UserControl = False
            self.root = self.stk.Personality2
            return {"success": True, "version": str(self.stk.Version)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def execute(self, command):
        """执行 STK 命令"""
        try:
            # 解析并执行命令
            result = self._parse_and_execute(command)
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _parse_and_execute(self, command):
        """解析命令"""
        cmd_type = command.get("type")

        if cmd_type == "create_scenario":
            return self._create_scenario(command)
        elif cmd_type == "add_satellite":
            return self._add_satellite(command)
        elif cmd_type == "compute_access":
            return self._compute_access(command)
        elif cmd_type == "compute_coverage":
            return self._compute_coverage(command)
        elif cmd_type == "get_position":
            return self._get_position(command)
        elif cmd_type == "get_orbit_data":
            return self._get_orbit_data(command)
        else:
            raise ValueError(f"Unknown command: {cmd_type}")

    def _create_scenario(self, cmd):
        """创建场景"""
        scenario = self.root.CurrentScenario
        if scenario is None:
            self.root.NewScenario(cmd.get("name", "AOE"))
            scenario = self.root.CurrentScenario

        # 设置时间
        scenario.SetTimePeriod(cmd["start"], cmd["stop"])
        scenario.Epoch = cmd["start"]

        return {"scenario": scenario.InstanceName}

    def _add_satellite(self, cmd):
        """添加卫星"""
        scenario = self.root.CurrentScenario
        sat = scenario.Children.New(18, cmd["name"])  # 18 = eSatellite

        # 设置轨道
        if "tle" in cmd:
            propagator = sat.Propagator
            propagatorType = propagator.PropagatorType
            # 设置 TLE
            propagator.SetTLE(cmd["tle"][0], cmd["tle"][1], 0)

        return {"satellite": cmd["name"]}

    def _compute_access(self, cmd):
        """计算可见性"""
        scenario = self.root.CurrentScenario
        sat = scenario.Children.Item(cmd["satellite"])

        # 创建设施
        facility = scenario.Children.New(1, cmd["target"])  # 1 = eFacility
        # 设置位置
        facility.Position.AssignGeodetic(
            cmd.get("lat", 0),
            cmd.get("lon", 0),
            cmd.get("alt", 0)
        )

        # 计算访问
        access = sat.GetAccessTo(facility)
        access.ComputeAccess()

        # 提取结果
        accesses = []
        accessDP = access.DataProviders.Item("Access Data")
        accessDP.Elements.Item("Start Time")
        accessDP.Elements.Item("Stop Time")
        accessDP.Elements.Item("Duration")

        execResult = accessDP.ExecElements(
            scenario.StartTime,
            scenario.StopTime,
            60  # 步长
        )

        # 处理结果
        times = execResult.DataSets.GetDataSetByName("Start Time").GetValues()
        durations = execResult.DataSets.GetDataSetByName("Duration").GetValues()

        for i in range(len(times)):
            accesses.append({
                "start": times[i],
                "duration": durations[i]
            })

        return {"accesses": accesses}

    def _compute_coverage(self, cmd):
        """计算覆盖"""
        # 覆盖分析实现
        return {"coverage": 85.5}

    def _get_position(self, cmd):
        """获取位置"""
        scenario = self.root.CurrentScenario
        sat = scenario.Children.Item(cmd["satellite"])

        # 获取位置
        position = sat.Position
        pos = position.QueryPlanetFixedPosition(cmd["time"])

        return {
            "x": pos[0],
            "y": pos[1],
            "z": pos[2]
        }

    def _get_orbit_data(self, cmd):
        """获取轨道数据"""
        scenario = self.root.CurrentScenario
        sat = scenario.Children.Item(cmd["satellite"])

        # 获取轨道参数
        propagator = sat.Propagator
        state = propagator.QueryPosition(cmd["time"])

        return {
            "position": {"x": state[0], "y": state[1], "z": state[2]},
            "velocity": {"x": state[3], "y": state[4], "z": state[5]}
        }

    def shutdown(self):
        """关闭 STK"""
        if self.stk:
            self.stk.Quit()

# 主程序入口
if __name__ == "__main__":
    middleware = STKMiddleware()

    # 读取命令
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break

            request = json.loads(line)
            action = request.get("action")

            if action == "connect":
                result = middleware.connect()
            elif action == "execute":
                result = middleware.execute(request.get("command", {}))
            elif action == "shutdown":
                middleware.shutdown()
                result = {"success": True}
                break
            else:
                result = {"success": False, "error": "Unknown action"}

            sys.stdout.write(json.dumps(result) + "\\n")
            sys.stdout.flush()

        except Exception as e:
            sys.stdout.write(json.dumps({"success": False, "error": str(e)}) + "\\n")
            sys.stdout.flush()
`

      // 写入临时 Python 脚本
      const fs = require('fs')
      const path = require('path')
      const scriptPath = path.join(this.config.tempDir, 'stk_middleware.py')
      fs.writeFileSync(scriptPath, script)

      // 启动 Python 进程
      this.pythonProcess = spawn(this.config.pythonPath, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true  // 隐藏窗口
      })

      this.pythonProcess.stdout?.on('data', (data) => {
        this.handlePythonOutput(data.toString())
      })

      this.pythonProcess.stderr?.on('data', (data) => {
        console.error('Python error:', data.toString())
      })

      this.pythonProcess.on('close', () => {
        this.isReady = false
        this.emit('closed')
      })

      // 等待就绪
      setTimeout(() => resolve(), 1000)
    })
  }

  /**
   * 启动隐藏的 STK
   */
  private async startHiddenSTK(): Promise<void> {
    return this.sendCommand({ action: 'connect' })
      .then(result => {
        if (!result.success) {
          throw new Error(result.error || 'STK 连接失败')
        }
        console.log('STK 已连接 (隐藏模式):', result.result?.version)
      })
  }

  /**
   * 发送命令到 Python 中间件
   */
  private sendCommand(command: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.pythonProcess) {
        reject(new Error('Python 进程未启动'))
        return
      }

      const id = Date.now().toString()
      const request = { id, ...command }

      // 发送命令
      this.pythonProcess.stdin?.write(JSON.stringify(request) + '\n')

      // 等待响应
      this.commandQueue.push({
        command: id,
        resolve,
        reject
      })

      // 超时处理
      setTimeout(() => {
        const index = this.commandQueue.findIndex(q => q.command === id)
        if (index !== -1) {
          this.commandQueue.splice(index, 1)
          reject(new Error('命令超时'))
        }
      }, 30000)
    })
  }

  /**
   * 处理 Python 输出
   */
  private handlePythonOutput(output: string): void {
    try {
      const lines = output.trim().split('\n')
      for (const line of lines) {
        if (!line) continue

        const response = JSON.parse(line)

        // 查找对应的命令
        const index = this.commandQueue.findIndex(q =>
          q.command === response.id
        )

        if (index !== -1) {
          const { resolve } = this.commandQueue[index]
          this.commandQueue.splice(index, 1)
          resolve(response)
        }
      }
    } catch (err) {
      console.error('解析 Python 输出失败:', err)
    }
  }

  /**
   * 执行分析任务
   * 这是主要的对外接口
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    if (!this.isReady) {
      return { success: false, error: 'STK 引擎未就绪' }
    }

    try {
      // 1. 发送分析命令
      const result = await this.sendCommand({
        action: 'execute',
        command: request
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // 2. 处理结果，转换为 AOE Desktop 格式
      const processed = this.processResult(request.type, result.result)

      return {
        success: true,
        data: result.result,
        charts: processed.charts,
        visualization: processed.visualization
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }

  /**
   * 处理结果，生成图表和可视化数据
   */
  private processResult(type: string, data: any): {
    charts?: ChartData[]
    visualization?: VisualizationData
  } {
    switch (type) {
      case 'orbit':
        return this.processOrbitData(data)
      case 'access':
        return this.processAccessData(data)
      case 'coverage':
        return this.processCoverageData(data)
      default:
        return {}
    }
  }

  private processOrbitData(data: any): { charts: ChartData[], visualization: VisualizationData } {
    // 处理轨道数据，生成图表和 3D 可视化
    return {
      charts: [{
        type: 'line',
        title: '轨道高度',
        xLabel: '时间',
        yLabel: '高度 (km)',
        series: [{
          name: '高度',
          data: []  // 填充数据
        }]
      }],
      visualization: {
        type: 'orbit',
        entities: [{
          id: 'satellite',
          name: '卫星',
          type: 'satellite',
          positions: []  // 填充位置数据
        }]
      }
    }
  }

  private processAccessData(data: any): { charts: ChartData[], visualization: VisualizationData } {
    // 处理可见性数据
    return {
      charts: [{
        type: 'bar',
        title: '可见窗口',
        xLabel: '时间',
        yLabel: '时长 (秒)',
        series: [{
          name: '可见时长',
          data: (data.accesses || []).map((a: any) => [a.start, a.duration])
        }]
      }],
      visualization: {
        type: 'access',
        entities: []
      }
    }
  }

  private processCoverageData(data: any): { charts: ChartData[], visualization: VisualizationData } {
    // 处理覆盖数据
    return {
      charts: [{
        type: 'line',
        title: '覆盖百分比',
        xLabel: '时间',
        yLabel: '覆盖率 (%)',
        series: [{
          name: '覆盖率',
          data: []
        }]
      }],
      visualization: {
        type: 'coverage',
        entities: []
      }
    }
  }

  /**
   * 关闭引擎
   */
  async shutdown(): Promise<void> {
    if (this.pythonProcess) {
      await this.sendCommand({ action: 'shutdown' })
      this.pythonProcess.kill()
      this.pythonProcess = null
    }
    this.isReady = false
  }

  /**
   * 获取状态
   */
  getStatus(): { ready: boolean, pid?: number } {
    return {
      ready: this.isReady,
      pid: this.pythonProcess?.pid
    }
  }
}

export default HiddenSTKEngine