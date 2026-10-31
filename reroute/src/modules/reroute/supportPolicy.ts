import { EUROPE_AIRPORTS, type LiveAircraft } from './live';
import type { ScheduledItinerary } from './recommendations';

// Approximate airport coordinates. Java mirror: SupportPolicy.
const coordinates: Record<string, readonly [number, number]> = {
  LHR: [51.47, -0.4543], LGW: [51.1537, -0.1821], CDG: [49.0097, 2.5479], ORY: [48.7262, 2.3652],
  FRA: [50.0379, 8.5622], MUC: [48.3538, 11.7861], BER: [52.3667, 13.5033], AMS: [52.3105, 4.7683],
  MAD: [40.4983, -3.5676], BCN: [41.2974, 2.0833], FCO: [41.8003, 12.2389], MXP: [45.6306, 8.7281],
  IST: [41.2753, 28.7519], DUB: [53.4213, -6.2701], ZRH: [47.4581, 8.5555], GVA: [46.2381, 6.1089],
  VIE: [48.1103, 16.5697], BRU: [50.9014, 4.4844], CPH: [55.6181, 12.6561], OSL: [60.1939, 11.1004],
  ARN: [59.6519, 17.9186], HEL: [60.3172, 24.9633], LIS: [38.7742, -9.1342], ATH: [37.9364, 23.9445],
  WAW: [52.1657, 20.9671], PRG: [50.1008, 14.26], BUD: [47.4298, 19.2611], OTP: [44.5711, 26.085],
};
export function airportDistanceKm(origin?: string, destination?: string): number | undefined {
  const point = (code?: string) => coordinates[EUROPE_AIRPORTS.find(a => a.code === code || a.iata === code)?.iata ?? code ?? ''];
  const a = point(origin), b = point(destination);
  if (!a || !b) return undefined;
  const rad = (v: number) => v * Math.PI / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function estimateFare(route: ScheduledItinerary): { low: number; high: number; currency: 'USD' } | undefined {
  if (!route.legs.length) return undefined;
  let base = 0;
  for (const leg of route.legs) {
    const km = airportDistanceKm(leg.origin, leg.destination);
    if (km === undefined) return undefined;
    base += 40 + km * 0.10;
  }
  return { low: Math.round(base * 0.8), high: Math.round(base * 1.4), currency: 'USD' };
}
export const VOUCHER_MIN_HOURS = 8;
export function voucherDecision(flight: LiveAircraft | null | undefined, alternativeCount: number, now = Date.now()) {
  const departure = Date.parse(flight?.scheduledDeparture ?? '');
  if (!Number.isFinite(departure)) return { status: 'unknown' as const, amount: 0 };
  if (alternativeCount > 0) return { status: 'route-found' as const, amount: 0 };
  const hours = Math.max(0, (now - departure) / 3600000);
  if (hours < VOUCHER_MIN_HOURS) return { status: 'waiting' as const, amount: 0, eligibleAt: departure + VOUCHER_MIN_HOURS * 3600000 };
  return { status: 'eligible' as const, amount: hours >= 12 ? 50 : 25 };
}
