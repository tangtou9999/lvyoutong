import type { GeoPoint } from '../map/types'

export interface PlaceCandidate {
  id: string
  name: string
  category: string
  location?: GeoPoint
}

export interface PotentialDuplicate {
  placeId: string
  match: 'same_location' | 'name_only'
  distanceMeters?: number
}

export function normalizePlaceName(name: string): string {
  return name
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]/gu, '')
}

function distanceMeters(a: GeoPoint, b: GeoPoint): number | null {
  if (a.crs !== b.crs) return null

  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const lat1 = radians(a.latitude)
  const lat2 = radians(b.latitude)
  const deltaLat = lat2 - lat1
  const deltaLon = radians(b.longitude - a.longitude)
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

/**
 * Finds candidates for human confirmation; it never merges or publishes records.
 * Coordinates are compared only when their CRS labels match.
 */
export function findPotentialPlaceDuplicates(
  candidate: PlaceCandidate,
  existing: PlaceCandidate[],
  radiusMeters = 120,
): PotentialDuplicate[] {
  const normalizedName = normalizePlaceName(candidate.name)
  if (!normalizedName || !Number.isFinite(radiusMeters) || radiusMeters < 0) return []

  return existing.flatMap((place) => {
    if (place.id === candidate.id) return []
    if (place.category !== candidate.category) return []
    if (normalizePlaceName(place.name) !== normalizedName) return []

    if (!candidate.location || !place.location) {
      return [{ placeId: place.id, match: 'name_only' as const }]
    }

    const distance = distanceMeters(candidate.location, place.location)
    if (distance === null) {
      return [{ placeId: place.id, match: 'name_only' as const }]
    }
    if (distance > radiusMeters) return []

    return [{
      placeId: place.id,
      match: 'same_location' as const,
      distanceMeters: Math.round(distance),
    }]
  })
}
