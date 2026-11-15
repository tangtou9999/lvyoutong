import { describe, expect, it } from 'vitest'
import {
  findPotentialPlaceDuplicates,
  normalizePlaceName,
  type PlaceCandidate,
} from './place-matching'

const wuhan = { longitude: 114.305, latitude: 30.592, crs: 'GCJ02' as const }

const existing: PlaceCandidate[] = [
  { id: 'a', name: '老张·热干面', category: '小吃', location: wuhan },
  { id: 'b', name: '老张热干面', category: '小吃', location: { ...wuhan, longitude: 114.3055 } },
  { id: 'c', name: '老张热干面', category: '餐馆', location: wuhan },
  { id: 'd', name: '老张热干面', category: '小吃', location: { ...wuhan, longitude: 114.32 } },
]

describe('商家档案候选去重', () => {
  it('统一全角字符、大小写、空格和标点', () => {
    expect(normalizePlaceName(' ＡＢＣ · 热干面 ')).toBe('abc热干面')
  })

  it('同名同类且位置接近时标记为位置候选重复', () => {
    const matches = findPotentialPlaceDuplicates(
      { id: 'new', name: '老张热干面', category: '小吃', location: wuhan },
      existing,
    )
    expect(matches.map((item) => item.placeId)).toEqual(['a', 'b'])
    expect(matches.every((item) => item.match === 'same_location')).toBe(true)
  })

  it('不同类别或距离过远时不自动判为重复', () => {
    const matches = findPotentialPlaceDuplicates(
      { id: 'new', name: '老张热干面', category: '小吃', location: wuhan },
      existing,
    )
    expect(matches.some((item) => item.placeId === 'c' || item.placeId === 'd')).toBe(false)
  })

  it('坐标参考系不同，只能作为名称候选，不能直接算距离', () => {
    const matches = findPotentialPlaceDuplicates(
      { id: 'new', name: '老张热干面', category: '小吃', location: { ...wuhan, crs: 'WGS84' } },
      [{ id: 'old', name: '老张热干面', category: '小吃', location: wuhan }],
    )
    expect(matches).toEqual([{ placeId: 'old', match: 'name_only' }])
  })

  it('没有位置时只提示人工核对，不执行自动合并', () => {
    expect(findPotentialPlaceDuplicates(
      { id: 'new', name: '老张热干面', category: '小吃' },
      [{ id: 'old', name: '老张热干面', category: '小吃' }],
    )).toEqual([{ placeId: 'old', match: 'name_only' }])
  })
})
