import type { CoordinateReferenceSystem, GeoPoint } from './types'

export function isValidGeoPoint(point: GeoPoint): boolean {
  return Number.isFinite(point.longitude)
    && Number.isFinite(point.latitude)
    && point.longitude >= -180
    && point.longitude <= 180
    && point.latitude >= -90
    && point.latitude <= 90
}

export function assertSameCoordinateReferenceSystem(
  first: CoordinateReferenceSystem,
  second: CoordinateReferenceSystem,
): void {
  if (first !== second) {
    throw new Error(`Coordinate reference system mismatch: ${first} vs ${second}`)
  }
}
