/**
 * Table 组件
 */

import React from 'react'

export interface TableColumn<T = any> {
  /** 列标题 */
  title: string
  /** 数据字段 */
  key: string
  /** 列宽度 */
  width?: string
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right'
  /** 自定义渲染 */
  render?: (value: any, record: T, index: number) => React.ReactNode
}

export interface TableProps<T = any> {
  /** 列定义 */
  columns: TableColumn<T>[]
  /** 数据源 */
  data: T[]
  /** 是否显示边框 */
  bordered?: boolean
  /** 是否显示斑马纹 */
  striped?: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 空状态文本 */
  emptyText?: string
  /** 行点击事件 */
  onRowClick?: (record: T, index: number) => void
  /** 自定义类名 */
  className?: string
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  bordered = true,
  striped = true,
  loading = false,
  emptyText = '暂无数据',
  onRowClick,
  className = '',
}: TableProps<T>) {
  const borderStyle = bordered ? 'border border-gray-200' : ''

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className={`w-full ${borderStyle}`}>
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-sm font-medium text-gray-700"
                style={{ width: col.width, textAlign: col.align || 'left' }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                加载中...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`
                  ${striped && rowIndex % 2 === 1 ? 'bg-gray-50' : ''}
                  ${onRowClick ? 'cursor-pointer hover:bg-gray-100' : ''}
                `}
                onClick={() => onRowClick?.(row, rowIndex)}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-4 py-3 text-sm text-gray-900"
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {col.render
                      ? col.render(row[col.key], row, rowIndex)
                      : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
