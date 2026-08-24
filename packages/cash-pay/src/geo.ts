import type { CashRateRow } from './types';

export const RADIUS_MILES = [10, 25, 50] as const;
export type RadiusMiles = (typeof RADIUS_MILES)[number] | 'metro';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_MILES = 3958.8;

export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pointFromRow(row: Pick<CashRateRow, 'latitude' | 'longitude'>): GeoPoint | null {
  if (row.latitude == null || row.longitude == null) return null;
  if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) return null;
  return { latitude: row.latitude, longitude: row.longitude };
}

/** Prefer a facility in the typed ZIP; otherwise the slice centroid. */
export function originFromSlice(
  rows: Array<Pick<CashRateRow, 'latitude' | 'longitude' | 'zip'>>,
  zip?: string | null,
): GeoPoint | null {
  const want = (zip || '').replace(/\D/g, '').slice(0, 5);
  if (want.length === 5) {
    const match = rows.find((row) => (row.zip || '').replace(/\D/g, '').startsWith(want) && pointFromRow(row));
    if (match) return pointFromRow(match);
    const prefix = want.slice(0, 3);
    const near = rows.find((row) => (row.zip || '').replace(/\D/g, '').startsWith(prefix) && pointFromRow(row));
    if (near) return pointFromRow(near);
  }
  const pts = rows.map(pointFromRow).filter((p): p is GeoPoint => p != null);
  if (pts.length === 0) return null;
  return {
    latitude: pts.reduce((s, p) => s + p.latitude, 0) / pts.length,
    longitude: pts.reduce((s, p) => s + p.longitude, 0) / pts.length,
  };
}

export function milesFromOrigin(row: Pick<CashRateRow, 'latitude' | 'longitude'>, origin: GeoPoint | null): number | null {
  const point = pointFromRow(row);
  if (!point || !origin) return null;
  return haversineMiles(origin, point);
}

export function filterByRadius<T extends Pick<CashRateRow, 'latitude' | 'longitude'>>(
  rows: T[],
  origin: GeoPoint | null,
  radius: RadiusMiles,
): T[] {
  if (radius === 'metro' || !origin) return rows;
  return rows.filter((row) => {
    const miles = milesFromOrigin(row, origin);
    return miles == null || miles <= radius;
  });
}

export function mapsUrl(row: Pick<CashRateRow, 'latitude' | 'longitude' | 'address' | 'facilityName' | 'city'>): string {
  const point = pointFromRow(row);
  if (point) return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
  const q = [row.address, row.facilityName, row.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function qualityLookupUrl(
  row: Pick<CashRateRow, 'facilityName' | 'city' | 'state'>,
): string {
  const q = `${row.facilityName} ${row.city} ${row.state} Healthgrades outcomes`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function npiUrl(npi: string | null | undefined): string | null {
  const id = (npi || '').replace(/\D/g, '');
  if (id.length < 10) return null;
  return `https://npiregistry.cms.hhs.gov/provider-view/${id}`;
}
