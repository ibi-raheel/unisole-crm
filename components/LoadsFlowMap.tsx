// Loads-flow map: an inline SVG US map showing where loads originate
// (pickup) and where they're headed (delivery). Pure server component —
// static SVG from aggregated numbers, no map tiles, no external requests.
//
// A hand-traced continental-US silhouette is drawn behind the data (using
// the SAME lat/lon projection as the state centroids, so everything lines
// up), which is what makes it read as a map rather than floating dots.

import { STATE_CENTROIDS } from "@/lib/usStates";

type Lane = { origin: string; dest: string };

// --- projection: geographic lat/lon -> SVG x/y -----------------------
const W = 960;
const H = 600;
const PAD = 44;
const LON_MIN = -125;
const LON_MAX = -66;
const LAT_MIN = 24;
const LAT_MAX = 50;

const INSET: Record<string, { x: number; y: number }> = {
  AK: { x: 66, y: 548 },
  HI: { x: 150, y: 566 },
};

function projectLL(lat: number, lon: number): { x: number; y: number } {
  const x = PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (W - 2 * PAD);
  const y = PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (H - 2 * PAD);
  return { x, y };
}

function project(code: string): { x: number; y: number } | null {
  if (INSET[code]) return INSET[code];
  const c = STATE_CENTROIDS[code];
  if (!c) return null;
  return projectLL(c.lat, c.lon);
}

// Coarse continental-US border, [lat, lon], traced as one closed loop:
// down the west coast, along the Mexican border, the Gulf, up the east
// coast, then back across the northern border. Stylised (Great Lakes
// simplified) — enough to read unmistakably as the US.
const US_OUTLINE: [number, number][] = [
  [49.0, -123.0], [48.4, -124.7], [46.3, -124.1], [43.3, -124.4], [40.4, -124.4],
  [38.9, -123.7], [37.8, -122.5], [36.6, -121.9], [34.5, -120.6], [34.0, -118.5],
  [33.0, -117.3], [32.5, -117.1], [32.7, -114.7], [31.3, -111.1], [31.3, -108.2],
  [31.8, -106.5], [29.8, -104.7], [29.3, -103.0], [29.8, -101.4], [28.0, -100.0],
  [26.0, -97.1], [27.8, -97.0], [28.4, -96.4], [29.7, -93.8], [29.2, -90.9],
  [29.0, -89.0], [30.3, -88.1], [30.4, -87.5], [30.0, -84.0], [29.7, -83.6],
  [27.8, -82.8], [26.0, -81.8], [25.2, -80.9], [25.8, -80.1], [27.9, -80.5],
  [30.7, -81.4], [32.0, -80.8], [33.9, -78.0], [35.2, -75.5], [36.9, -76.0],
  [38.0, -75.2], [38.9, -74.9], [40.5, -74.0], [41.0, -71.9], [41.7, -70.5],
  [42.7, -70.8], [43.7, -70.0], [44.3, -68.2], [44.8, -67.0], [47.1, -69.2],
  [45.0, -71.5], [45.0, -74.7], [44.1, -76.4], [43.3, -79.2], [42.4, -79.8],
  [41.7, -82.7], [41.7, -83.5], [45.0, -83.4], [45.8, -84.4], [45.1, -87.6],
  [46.7, -90.4], [47.3, -95.0], [49.0, -95.2], [49.0, -104.0], [49.0, -116.0],
];

const OUTLINE_PATH =
  US_OUTLINE.map(([lat, lon], i) => {
    const p = projectLL(lat, lon);
    return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ") + " Z";

export function LoadsFlowMap({ lanes }: { lanes: Lane[] }) {
  const laneCounts = new Map<string, { origin: string; dest: string; n: number }>();
  const outbound = new Map<string, number>();
  const inbound = new Map<string, number>();

  for (const { origin, dest } of lanes) {
    outbound.set(origin, (outbound.get(origin) ?? 0) + 1);
    inbound.set(dest, (inbound.get(dest) ?? 0) + 1);
    if (origin === dest) continue;
    const key = `${origin}>${dest}`;
    const cur = laneCounts.get(key) ?? { origin, dest, n: 0 };
    cur.n += 1;
    laneCounts.set(key, cur);
  }

  const activeStates = new Set<string>([...outbound.keys(), ...inbound.keys()]);
  const maxLane = Math.max(1, ...[...laneCounts.values()].map((l) => l.n));
  const maxActivity = Math.max(
    1,
    ...[...activeStates].map((s) => (outbound.get(s) ?? 0) + (inbound.get(s) ?? 0))
  );

  const totalLoads = lanes.length;
  const laneList = [...laneCounts.values()].sort((a, b) => b.n - a.n);

  return (
    <div className="card map-card">
      <div className="map-head">
        <div>
          <div className="section-title" style={{ margin: 0 }}>Loads flow — origin → destination</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {totalLoads} load{totalLoads === 1 ? "" : "s"} across {activeStates.size} state
            {activeStates.size === 1 ? "" : "s"}
          </div>
        </div>
        <div className="map-legend">
          <span className="lg"><i className="lg-dot lg-origin" />Pickup</span>
          <span className="lg"><i className="lg-dot lg-dest" />Delivery</span>
          <span className="lg"><i className="lg-line" />lane · thicker = more loads</span>
        </div>
      </div>

      {totalLoads === 0 ? (
        <div className="empty">No loads booked yet — the map fills in as loads are created.</div>
      ) : (
        <div className="flow-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="flow-svg" role="img"
            aria-label="US map of load origins and destinations">
            <defs>
              <linearGradient id="usFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f3eefc" />
                <stop offset="100%" stopColor="#eef5ff" />
              </linearGradient>
              <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.6" floodColor="#2e1f5e" floodOpacity="0.35" />
              </filter>
              <marker id="flowArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7"
                markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                <path d="M0,1 L9,5 L0,9" fill="none" stroke="var(--pink-600)" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            {/* US silhouette */}
            <path d={OUTLINE_PATH} className="us-shape" />

            {/* lanes: soft base + animated flow overlay */}
            {laneList.map(({ origin, dest, n }) => {
              const a = project(origin);
              const b = project(dest);
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              const off = Math.min(90, len * 0.22);
              const cx = mx + (-dy / len) * off;
              const cy = my + (dx / len) * off;
              const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
              const width = 2 + (n / maxLane) * 6;
              return (
                <g key={`${origin}-${dest}`}>
                  <path d={d} className="lane-base" strokeWidth={width}>
                    <title>{origin} → {dest}: {n} load{n === 1 ? "" : "s"}</title>
                  </path>
                  <path d={d} className="lane-flow" markerEnd="url(#flowArrow)" />
                </g>
              );
            })}

            {/* active-state markers */}
            {[...activeStates].map((code) => {
              const p = project(code);
              if (!p) return null;
              const out = outbound.get(code) ?? 0;
              const inn = inbound.get(code) ?? 0;
              const r = 5 + ((out + inn) / maxActivity) * 6;
              const cls = out >= inn ? "state-origin" : "state-dest";
              return (
                <g key={`act-${code}`}>
                  <circle cx={p.x} cy={p.y} r={r} className={cls} filter="url(#dotShadow)">
                    <title>{STATE_CENTROIDS[code]?.name ?? code}: {out} out, {inn} in</title>
                  </circle>
                  <text x={p.x} y={p.y - r - 4} className="state-label" textAnchor="middle">
                    {code}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {laneList.length > 0 && (
        <div className="lane-table">
          <div className="section-title" style={{ marginBottom: 8 }}>Busiest lanes</div>
          {laneList.slice(0, 5).map((l) => (
            <div key={`${l.origin}-${l.dest}`} className="lane-row">
              <span className="lane-pair">
                <span className="lane-chip">{l.origin}</span>
                <span className="lane-arrow">→</span>
                <span className="lane-chip">{l.dest}</span>
              </span>
              <span className="num lane-count">{l.n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
