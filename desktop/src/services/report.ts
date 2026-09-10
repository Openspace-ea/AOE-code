/**
 * 报告服务
 */

import api from './api'

export interface Report {
  id: string
  title: string
  report_type: string
  params?: Record<string, any>
  status: 'pending' | 'generating' | 'completed' | 'failed'
  file_url?: string
  file_size?: number
  error_message?: string
  created_at: string
  completed_at?: string
}

export interface ReportCreateRequest {
  title: string
  report_type: string
  params?: Record<string, any>
  format?: string
}

export const reportService = {
  /**
   * 获取报告列表
   */
  async list(): Promise<Report[]> {
    const result = await api.getReports()
    if (result.success) {
      return (result.data as any).reports || []
    }
    throw new Error(result.error)
  },

  /**
   * 获取报告详情
   */
  async get(id: string): Promise<Report> {
    const result = await api.request(`/v1/reports/${id}`)
    if (result.success) {
      return result.data as Report
    }
    throw new Error(result.error)
  },

  /**
   * 生成报告
   */
  async generate(request: ReportCreateRequest): Promise<{ report_id: string, status: string }> {
    const result = await api.generateReport(request.title, request.report_type, request.params || {})
    if (result.success) {
      return result.data as any
    }
    throw new Error(result.error)
  },

  /**
   * 下载报告
   */
  async download(id: string): Promise<{ file_url: string, filename: string }> {
    const result = await api.request(`/v1/reports/${id}/download`)
    if (result.success) {
      return result.data as any
    }
    throw new Error(result.error)
  },

  /**
   * 等待报告完成
   */
  async waitComplete(id: string, timeout = 60000): Promise<Report> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const report = await this.get(id)
      if (report.status === 'completed' || report.status === 'failed') {
        return report
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    throw new Error('报告生成超时')
  }
}

export default reportService