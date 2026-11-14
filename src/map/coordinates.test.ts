import { describe, expect, it } from 'vitest'
import {
  assertSameCoordinateReferenceSystem,
  isValidGeoPoint,
} from './coordinates'

describe('地图坐标基础校验', () => {
  it('接受范围内的经纬度', () => {
    expect(isValidGeoPoint({ longitude: 114.3, latitude: 30.6, crs: 'WGS84' })).toBe(true)
  })

  it('拒绝越界或非数字坐标', () => {
    expect(isValidGeoPoint({ longitude: 181, latitude: 30, crs: 'WGS84' })).toBe(false)
    expect(isValidGeoPoint({ longitude: 114, latitude: Number.NaN, crs: 'GCJ02' })).toBe(false)
  })

  it('禁止不同坐标参考系直接混用', () => {
    expect(() => assertSameCoordinateReferenceSystem('WGS84', 'GCJ02')).toThrow(
      'Coordinate reference system mismatch',
    )
    expect(() => assertSameCoordinateReferenceSystem('GCJ02', 'GCJ02')).not.toThrow()
  })
})
