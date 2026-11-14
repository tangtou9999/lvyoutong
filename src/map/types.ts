export type CoordinateReferenceSystem = 'WGS84' | 'GCJ02' | 'BD09'

export interface GeoPoint {
  longitude: number
  latitude: number
  crs: CoordinateReferenceSystem
}

export interface MapViewport {
  center: GeoPoint
  zoom: number
}

export interface PlaceMarker {
  id: string
  title: string
  position: GeoPoint
}

export interface MapAdapter {
  mount(container: HTMLElement, initialViewport: MapViewport): Promise<void>
  setViewport(viewport: MapViewport): void
  setMarkers(markers: PlaceMarker[]): void
  onMapClick(handler: (point: GeoPoint) => void): () => void
  destroy(): void
}

export interface PlaceSearchQuery {
  keyword: string
  center?: GeoPoint
  radiusMeters?: number
  limit?: number
}

export interface PlaceSearchResult {
  providerId: string
  name: string
  address?: string
  location: GeoPoint
  category?: string
}

export interface MapSearchProvider {
  searchPlaces(query: PlaceSearchQuery): Promise<PlaceSearchResult[]>
  geocode(address: string): Promise<GeoPoint | null>
  reverseGeocode(point: GeoPoint): Promise<string | null>
}
