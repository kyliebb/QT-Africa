export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function findNearby<T extends { lat: number | null; lng: number | null; id: string }>(
  anchor: T,
  all: T[],
  radiusKm: number
): T[] {
  if (anchor.lat == null || anchor.lng == null) return []
  return all.filter(d => {
    if (d.id === anchor.id || d.lat == null || d.lng == null) return false
    return haversineKm(anchor.lat!, anchor.lng!, d.lat, d.lng) <= radiusKm
  })
}
