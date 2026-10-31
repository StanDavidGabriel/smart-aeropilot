import { scheduleTime, type ScheduledItinerary } from '../recommendations';
import { useEffect, useState } from 'react';
import type { LiveAircraft } from '../live';
import { estimateFare, voucherDecision } from '../supportPolicy';

export function ScheduledAlternatives({ aircraft, flights, pending, error }: { aircraft: LiveAircraft; flights?: ScheduledItinerary[] | undefined; pending: boolean; error: boolean }) {
  const [now, setNow] = useState<number | undefined>();
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const voucher = now !== undefined && !pending && !error && flights !== undefined ? voucherDecision(aircraft, flights.length, now) : undefined;
  return <div className="space-y-2 border-t border-border pt-2 text-sm">
    <p className="font-semibold">Recommended departures</p>
    {pending ? <p className="text-muted-foreground">Checking later flights…</p> : error ? <p className="text-destructive">Schedules could not be checked. Try refreshing.</p> : !flights?.length ? <p className="text-muted-foreground">No alternative found within 24 hours using available OTP departures and simulated onward schedules.</p> : flights.map(route => <div key={route.legs.map(f => f.id).join(':')} className="space-y-2 border-l-2 border-primary pl-2">
      <p className="text-xs text-muted-foreground">{route.legs.length === 1 ? 'Direct' : '1 connection'}</p>
      <p className="font-semibold text-primary">{(() => { const fare = estimateFare(route); return fare ? `Estimated fare: $${fare.low}–$${fare.high} / passenger` : 'Fare estimate unavailable'; })()}</p>
      {route.legs.some(f => f.scheduleSource === 'simulated') && <p className="text-xs font-semibold text-primary">Demo connection · includes a simulated flight</p>}
      {route.legs.map(f => <div key={f.id}>
      <p className="board text-primary">{f.callsign} · {f.origin} → {f.destination}</p>
      <p>Departure {scheduleTime(f.scheduledDeparture)}</p>
      <p className="text-xs font-semibold text-muted-foreground">{f.scheduleSource === 'simulated' ? 'Simulated schedule · not a real flight' : 'Real OTP schedule · AeroDataBox'}</p>
      {f.scheduledArrival && <p className="text-muted-foreground">Arrival {scheduleTime(f.scheduledArrival)}</p>}
      {f.airline && <p className="text-xs text-muted-foreground">{f.airline}</p>}
      </div>)}
    </div>)}
    {voucher?.status === 'eligible' && <div className="border-l-2 border-success pl-2 text-success"><p className="font-semibold">Demo voucher: ${voucher.amount} USD per passenger</p><p className="text-xs">No route found · disruption of at least {voucher.amount === 50 ? 12 : 8} hours. Simulation only; not redeemable.</p></div>}
    {voucher?.status === 'waiting' && <p className="text-xs text-muted-foreground">No voucher yet. Eligible after 8 hours from scheduled departure ({scheduleTime(new Date(voucher.eligibleAt).toISOString())}), only if no route is found. $25 USD; $50 after 12 hours.</p>}
    {voucher?.status === 'route-found' && <p className="text-xs text-muted-foreground">No fallback voucher: a suggested route is available.</p>}
    {voucher?.status === 'unknown' && <p className="text-xs text-muted-foreground">Voucher eligibility unknown: scheduled departure is missing.</p>}
    {(pending || error) && <p className="text-xs text-muted-foreground">Voucher assessment awaits a successful schedule check.</p>}
    <p className="text-xs text-muted-foreground">Distance-based demo fares · not live ticket prices · baggage and fees excluded. Schedule suggestions only; seats and booking unconfirmed. Demo vouchers are not statutory compensation.</p>
  </div>;
}