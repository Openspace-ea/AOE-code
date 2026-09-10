/**
 * 场景动作 → function calling 工具的适配辅助
 *
 * 场景页现有的动作执行器（executeActions）返回中文字符串描述执行结果，
 * 这里统一包成 ToolResult 回灌给 LLM：明显的失败描述（未找到/非法参数等）
 * 标记 success: false，让模型知道操作没成功、可以纠正后重试。
 */

import type { ToolResult } from '@aoe/agent'

/** 失败描述的开头特征（与各场景执行器返回文案保持一致） */
const FAILURE_PREFIX = /^(未找到|非法|不支持|缺少|当前无|未知|无法|发射后无法)/

/** 把场景动作执行器的结果字符串包成 ToolResult */
export function wrapActionResult(result: string): ToolResult {
  return { success: !FAILURE_PREFIX.test(result), content: result }
}

/**
 * 把单个场景动作交给执行器并包装结果。
 * executeActions 是场景页注入的动作执行回调（与页面按钮共用同一套逻辑）。
 */
export async function runSceneAction(
  executeActions: (actions: Record<string, unknown>[]) => string[],
  action: Record<string, unknown>,
): Promise<ToolResult> {
  const [result] = executeActions([action])
  return wrapActionResult(result ?? '动作未产生结果')
}
