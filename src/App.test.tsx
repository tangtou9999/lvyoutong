/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from './App'

afterEach(() => cleanup())

describe('旅游通首页', () => {
  it('展示真实地图占位说明，不伪造商家数据', () => {
    render(<App />)
    expect(screen.getByText('真实地图即将接入')).toBeInTheDocument()
    expect(screen.getByText('这片区域还在等待第一份真实记录')).toBeInTheDocument()
  })

  it('切换主导航时更新页面标题', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '地图' }))
    expect(screen.getByRole('heading', { name: '把旅行装进地图' })).toBeInTheDocument()
  })

  it('搜索框能够输入和清除关键词', () => {
    render(<App />)
    const input = screen.getByRole('textbox', { name: '搜索街区、景点、小吃或店铺' })
    fireEvent.change(input, { target: { value: '户部巷' } })
    expect(input).toHaveValue('户部巷')
    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }))
    expect(input).toHaveValue('')
  })

  it('发布入口明确说明当前尚未开放真实发布', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '记录我的第一次体验' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/第一版正在搭建发布能力/)).toBeInTheDocument()
  })
})
