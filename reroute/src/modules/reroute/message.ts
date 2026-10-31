import type { Flight, RerouteResult } from './types';

export function fallbackMessage(cancelled: Flight, r: RerouteResult): string {
  const first = r.passenger.name.split(' ')[0];
  if (!r.chosen) return `Hi ${first}, flight ${cancelled.id} to ${cancelled.to} was cancelled and no alternative itinerary has been found yet. Your demo voucher is ${r.voucher.total} EUR. Your booking is awaiting assistance.`;
  const route = r.chosen.legs.map(l => `${l.id} (${l.from} ${l.depart} → ${l.to} ${l.arrive})`).join(', ');
  return `Hi ${first}, flight ${cancelled.id} was cancelled and your demo booking has been moved to: ${route}. You arrive at ${r.chosen.arrive}.${r.voucher.total > 0 ? ` Your demo voucher is ${r.voucher.total} EUR.` : ''}`;
}
