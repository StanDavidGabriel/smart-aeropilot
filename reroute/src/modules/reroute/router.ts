// Pure TypeScript mirror of the Java engine (java/reroute-engine). Used as a
// browser fallback when the Java service is not reachable, and in tests.
import type { CancelResponse, Flight, Itinerary, Network, Passenger, RerouteResult } from "./types";

export const toMin = (hm: string) => { const [h = 0, m = 0] = hm.split(":").map(Number); return h * 60 + m; };
export const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

interface Label { airport: string; time: number; legs: Flight[]; cost: number }

export interface RouteOptions {
  minConnection?: number; connectionPenalty?: number; maxStops?: number; k?: number;
  partySize?: number; excluded?: Set<string>;
}

/** Time-dependent Dijkstra over (airport, arrival_time); returns top-K distinct itineraries. */
export function topK(
  flights: Flight[], origin: string, dest: string, earliest: number,
  seatsLeft: Map<string, number>, o: RouteOptions = {},
): Itinerary[] {
  const mct = o.minConnection ?? 45, pen = o.connectionPenalty ?? 30, maxStops = o.maxStops ?? 2;
  const k = o.k ?? 3, party = o.partySize ?? 1, excluded = o.excluded ?? new Set<string>();
  const byOrigin = new Map<string, Flight[]>();
  for (const f of flights) (byOrigin.get(f.from) ?? byOrigin.set(f.from, []).get(f.from)!).push(f);

  const pq: Label[] = [{ airport: origin, time: earliest, legs: [], cost: earliest }];
  const settled = new Map<string, number>();
  const out: Itinerary[] = [];
  const seen = new Set<string>();

  while (pq.length && out.length < k) {
    pq.sort((a, b) => a.cost - b.cost);
    const cur = pq.shift()!;
    if (cur.airport === dest && cur.legs.length) {
      const key = cur.legs.map((l) => l.id).join(">");
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          legs: cur.legs, depart: cur.legs[0]!.depart, arrive: cur.legs[cur.legs.length - 1]!.arrive,
          stops: cur.legs.length - 1, cost: cur.cost,
        });
      }
      continue;
    }
    const count = (settled.get(cur.airport) ?? 0) + 1;
    settled.set(cur.airport, count);
    if (count > k || cur.legs.length > maxStops) continue;
    const ready = cur.legs.length ? cur.time + mct : cur.time;
    for (const f of byOrigin.get(cur.airport) ?? []) {
      if (excluded.has(f.id) || toMin(f.depart) < ready) continue;
      if ((seatsLeft.get(f.id) ?? 0) < party) continue;
      if (f.to === origin || cur.legs.some((l) => l.from === f.to)) continue;
      const legs = [...cur.legs, f];
      pq.push({ airport: f.to, time: toMin(f.arrive), legs, cost: toMin(f.arrive) + pen * (legs.length - 1) });
    }
  }
  return out;
}

export function priority(p: Passenger): number {
  let s = 0;
  if (p.tight_connection) s += 3;
  if (p.family_size > 1) s += 2 + 0.5 * p.family_size;
  if (p.deadline) s += 3 + Math.max(0, (20 * 60 - toMin(p.deadline)) / 120);
  return Math.round(s * 10) / 10;
}

export const VOUCHER_RULES = [
  { label: "Delay over 3 hours", amount: 250, kind: "compensation" },
  { label: "Delay over 2 hours", amount: 125, kind: "compensation" },
  { label: "Delay over 1 hour — meal", amount: 15, kind: "meal" },
  { label: "No alternative itinerary", amount: 265, kind: "refund + meal" },
] as const;

export function voucher(delay: number | null): { compensation: number; meal: number } {
  if (delay === null) return { compensation: 250, meal: 15 };
  return { compensation: delay > 180 ? 250 : delay > 120 ? 125 : 0, meal: delay > 60 ? 15 : 0 };
}

export function cancelFlight(net: Network, flightId: string): CancelResponse {
  const cancelled = net.flights.find((f) => f.id === flightId);
  if (!cancelled) throw new Error(`Unknown flight ${flightId}`);
  const seats = new Map(net.flights.map((f) => [f.id, f.seats_available]));
  const affected = net.passengers
    .filter((p) => p.flight === flightId)
    .sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id));
  const results: RerouteResult[] = affected.map((p) => {
    const options = topK(net.flights, cancelled.from, cancelled.to, toMin(cancelled.depart), seats, {
      minConnection: net.defaults.min_connection_minutes,
      connectionPenalty: net.defaults.connection_penalty_minutes,
      maxStops: net.defaults.max_stops, partySize: p.family_size, excluded: new Set([flightId]),
    });
    const chosen = options[0] ?? null;
    let delay: number | null = null;
    if (chosen) {
      for (const l of chosen.legs) seats.set(l.id, (seats.get(l.id) ?? 0) - p.family_size);
      delay = toMin(chosen.arrive) - toMin(cancelled.arrive);
    }
    const v = voucher(delay);
    return {
      passenger: p, priority: priority(p), options, chosen, delay_minutes: delay,
      voucher: { ...v, total: v.compensation + v.meal, code: `AP-${p.id}-${flightId}` },
      status: chosen ? "rebooked" : "unrouted",
    };
  });
  return { cancelled, engine: "browser", results };
}
