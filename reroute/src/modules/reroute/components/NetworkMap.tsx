import type { Airport, Flight, Itinerary } from "../types";

const W = 640, H = 420;
const proj = (a: Airport) => ({
  x: ((a.lon + 5) / 34) * (W - 40) + 20,
  y: H - (((a.lat - 39.5) / 14) * (H - 40) + 20),
});

export function NetworkMap({
  airports, flights, cancelled, highlight,
}: { airports: Airport[]; flights: Flight[]; cancelled?: Flight | undefined; highlight?: Itinerary | null | undefined }) {
  const pos = new Map(airports.map((a) => [a.code, proj(a)]));
  const hl = new Set(highlight?.legs.map((l) => l.id) ?? []);
  const hlAirports = new Set(highlight?.legs.flatMap((l) => [l.from, l.to]) ?? []);
  const line = (f: Flight) => ({ a: pos.get(f.from)!, b: pos.get(f.to)! });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Flight network">
      {flights.map((f) => {
        const { a, b } = line(f);
        return <line key={f.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-border" strokeWidth={1} />;
      })}
      {cancelled && (() => {
        const { a, b } = line(cancelled);
        return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-destructive" strokeWidth={2.5} strokeDasharray="4 4" />;
      })()}
      {highlight?.legs.map((f) => {
        const { a, b } = line(f);
        return <line key={`h-${f.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="route-flow stroke-primary" strokeWidth={3.5} />;
      })}
      {airports.map((ap) => {
        const p = pos.get(ap.code)!;
        const on = hlAirports.has(ap.code);
        return (
          <g key={ap.code}>
            <circle cx={p.x} cy={p.y} r={on ? 6 : 4} className={on ? "fill-primary" : "fill-accent"} />
            <text x={p.x + 7} y={p.y - 6} className={`board text-[10px] ${on ? "fill-primary" : "fill-muted-foreground"}`}>
              {ap.code}
            </text>
          </g>
        );
      })}
      {hl.size === 0 && !cancelled && null}
    </svg>
  );
}
