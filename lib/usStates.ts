// US state geography for the dashboard loads-flow map.
//
// Load locations are stored as free-text "City, ST" (there are no lat/long
// columns), so the map works at the STATE level: we parse the two-letter
// state out of each location string and plot loads on that state's
// approximate geographic centroid. No external geocoding service, no API
// key, no network — the whole map renders from the numbers below.

export type StateCentroid = { name: string; lat: number; lon: number };

// Approximate geographic centroids (continental US). Alaska & Hawaii are
// drawn in insets by the map component, so their coords here are unused for
// projection but kept for completeness / labels.
export const STATE_CENTROIDS: Record<string, StateCentroid> = {
  AL: { name: "Alabama", lat: 32.8, lon: -86.8 },
  AK: { name: "Alaska", lat: 64.0, lon: -152.0 },
  AZ: { name: "Arizona", lat: 34.2, lon: -111.7 },
  AR: { name: "Arkansas", lat: 34.9, lon: -92.4 },
  CA: { name: "California", lat: 37.2, lon: -119.4 },
  CO: { name: "Colorado", lat: 39.0, lon: -105.5 },
  CT: { name: "Connecticut", lat: 41.6, lon: -72.7 },
  DE: { name: "Delaware", lat: 39.0, lon: -75.5 },
  DC: { name: "District of Columbia", lat: 38.9, lon: -77.0 },
  FL: { name: "Florida", lat: 28.6, lon: -82.4 },
  GA: { name: "Georgia", lat: 32.6, lon: -83.4 },
  HI: { name: "Hawaii", lat: 20.3, lon: -156.4 },
  ID: { name: "Idaho", lat: 44.2, lon: -114.5 },
  IL: { name: "Illinois", lat: 40.0, lon: -89.2 },
  IN: { name: "Indiana", lat: 39.9, lon: -86.3 },
  IA: { name: "Iowa", lat: 42.0, lon: -93.5 },
  KS: { name: "Kansas", lat: 38.5, lon: -98.4 },
  KY: { name: "Kentucky", lat: 37.5, lon: -85.3 },
  LA: { name: "Louisiana", lat: 31.0, lon: -92.0 },
  ME: { name: "Maine", lat: 45.4, lon: -69.2 },
  MD: { name: "Maryland", lat: 39.0, lon: -76.8 },
  MA: { name: "Massachusetts", lat: 42.3, lon: -71.8 },
  MI: { name: "Michigan", lat: 44.3, lon: -85.4 },
  MN: { name: "Minnesota", lat: 46.3, lon: -94.3 },
  MS: { name: "Mississippi", lat: 32.7, lon: -89.7 },
  MO: { name: "Missouri", lat: 38.4, lon: -92.5 },
  MT: { name: "Montana", lat: 47.0, lon: -109.6 },
  NE: { name: "Nebraska", lat: 41.5, lon: -99.8 },
  NV: { name: "Nevada", lat: 39.3, lon: -116.6 },
  NH: { name: "New Hampshire", lat: 43.7, lon: -71.6 },
  NJ: { name: "New Jersey", lat: 40.2, lon: -74.7 },
  NM: { name: "New Mexico", lat: 34.4, lon: -106.1 },
  NY: { name: "New York", lat: 42.9, lon: -75.5 },
  NC: { name: "North Carolina", lat: 35.5, lon: -79.4 },
  ND: { name: "North Dakota", lat: 47.5, lon: -100.3 },
  OH: { name: "Ohio", lat: 40.3, lon: -82.8 },
  OK: { name: "Oklahoma", lat: 35.6, lon: -97.5 },
  OR: { name: "Oregon", lat: 43.9, lon: -120.6 },
  PA: { name: "Pennsylvania", lat: 40.9, lon: -77.8 },
  RI: { name: "Rhode Island", lat: 41.7, lon: -71.5 },
  SC: { name: "South Carolina", lat: 33.9, lon: -80.9 },
  SD: { name: "South Dakota", lat: 44.4, lon: -100.2 },
  TN: { name: "Tennessee", lat: 35.9, lon: -86.4 },
  TX: { name: "Texas", lat: 31.5, lon: -99.3 },
  UT: { name: "Utah", lat: 39.3, lon: -111.7 },
  VT: { name: "Vermont", lat: 44.1, lon: -72.7 },
  VA: { name: "Virginia", lat: 37.5, lon: -78.9 },
  WA: { name: "Washington", lat: 47.4, lon: -120.5 },
  WV: { name: "West Virginia", lat: 38.6, lon: -80.6 },
  WI: { name: "Wisconsin", lat: 44.6, lon: -89.9 },
  WY: { name: "Wyoming", lat: 43.0, lon: -107.5 },
};

// Pull the two-letter US state out of a free-text "City, ST" string.
// Strategy: look at the text after the last comma first (that's where the
// state lives in "City, ST" / "City, ST 12345"); fall back to scanning all
// two-letter tokens from the end. Returns null if no valid state is found.
export function parseUsState(loc?: string | null): string | null {
  if (!loc) return null;
  const upper = loc.toUpperCase();
  const tail = upper.includes(",") ? upper.slice(upper.lastIndexOf(",") + 1) : upper;
  const tailTokens = tail.match(/[A-Z]{2}/g) ?? [];
  for (const t of tailTokens) if (STATE_CENTROIDS[t]) return t;
  // Fallback: scan the whole string, prefer the last valid match.
  const all = upper.match(/[A-Z]{2}/g) ?? [];
  for (let i = all.length - 1; i >= 0; i--) if (STATE_CENTROIDS[all[i]]) return all[i];
  return null;
}
