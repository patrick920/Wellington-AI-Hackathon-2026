/**
 * regions.js
 * ----------
 * A lookup table of New Zealand regions with approximate centre coordinates.
 *
 * WHY THIS EXISTS:
 * The whole point of the platform is matching waste producers with people who
 * can use that waste *nearby* — trucking wet organic waste 800km destroys the
 * environmental benefit. So we need coordinates to calculate distances.
 *
 * These are approximate regional centroids (good enough for a demo). In a real
 * product you would geocode the actual pickup address.
 */

export const REGIONS = [
  { name: 'Northland',          island: 'North', lat: -35.72, lng: 174.32 },
  { name: 'Auckland',           island: 'North', lat: -36.85, lng: 174.76 },
  { name: 'Waikato',            island: 'North', lat: -37.79, lng: 175.28 },
  { name: 'Bay of Plenty',      island: 'North', lat: -37.69, lng: 176.17 },
  { name: 'Gisborne',           island: 'North', lat: -38.66, lng: 178.02 },
  { name: "Hawke's Bay",        island: 'North', lat: -39.49, lng: 176.92 },
  { name: 'Taranaki',           island: 'North', lat: -39.06, lng: 174.08 },
  { name: 'Manawatū-Whanganui', island: 'North', lat: -40.35, lng: 175.61 },
  { name: 'Wellington',         island: 'North', lat: -41.29, lng: 174.78 },
  { name: 'Tasman',             island: 'South', lat: -41.27, lng: 173.28 },
  { name: 'Nelson',             island: 'South', lat: -41.30, lng: 173.24 },
  { name: 'Marlborough',        island: 'South', lat: -41.51, lng: 173.95 },
  { name: 'West Coast',         island: 'South', lat: -42.45, lng: 171.21 },
  { name: 'Canterbury',         island: 'South', lat: -43.53, lng: 172.64 },
  { name: 'Otago',              island: 'South', lat: -45.87, lng: 170.50 },
  { name: 'Southland',          island: 'South', lat: -46.41, lng: 168.35 }
];

/** Quick lookup: region name -> region object. */
export const REGION_BY_NAME = Object.fromEntries(REGIONS.map(r => [r.name, r]));

/**
 * Haversine formula: the great-circle distance between two lat/lng points in km.
 * This is the standard way to measure "as the crow flies" distance on a sphere.
 */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometres
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/**
 * Distance between two named regions. Returns null if either name is unknown,
 * so callers can decide how to handle "we don't know where this is".
 */
export function distanceBetweenRegions(a, b) {
  const ra = REGION_BY_NAME[a];
  const rb = REGION_BY_NAME[b];
  if (!ra || !rb) return null;
  return distanceKm(ra.lat, ra.lng, rb.lat, rb.lng);
}
