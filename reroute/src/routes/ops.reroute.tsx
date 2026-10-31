import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { LiveFlightBoard } from '@/modules/reroute/components/LiveFlightBoard';
import { liveSnapshotOptions } from '@/modules/reroute/live.query';
import { useSimulation } from '@/modules/reroute/useSimulation';
import { useRecommendations } from '@/modules/reroute/useRecommendations';
import { ScheduledAlternatives } from '@/modules/reroute/components/ScheduledAlternatives';

export const Route = createFileRoute('/ops/reroute')({
  loader: ({ context }) => context.queryClient.ensureQueryData(liveSnapshotOptions),
  head: () => ({ meta: [
    { title: 'Live flight operations — AeroPilot' },
    { name: 'description', content: 'AeroDataBox flight schedules and airline status with simulated cancellation notifications for demo passengers.' },
    { property: 'og:title', content: 'Live flight operations — AeroPilot' },
    { property: 'og:description', content: 'Monitor AeroDataBox flights and manage passenger cancellation simulations.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: OpsReroute,
});

function OpsReroute() {
  const state = useSimulation();
  const recommendations = useRecommendations(state);
  const cancelled = Object.values(state.flights).filter(f => f.cancelled);
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="board text-xs uppercase text-primary">AeroPilot · Ops</p><h1 className="text-3xl font-bold">Live flight operations</h1></div>
      <Button variant="outline" asChild><Link to="/passenger">Passenger notifications</Link></Button>
    </header>
    <LiveFlightBoard />
    {cancelled.length > 0 && <section className="space-y-4 border-b border-border pb-6" aria-label="Flight alternatives">
      <h2 className="text-xl font-semibold">Flight alternatives</h2>
      {cancelled.map(f => <div key={f.aircraft.id}>
        <p className="board">{f.aircraft.callsign} · {f.aircraft.origin} → {f.aircraft.destination}</p>
        <ScheduledAlternatives aircraft={f.aircraft} flights={recommendations.get(f.aircraft.id)?.data} pending={recommendations.get(f.aircraft.id)?.isPending ?? true} error={recommendations.get(f.aircraft.id)?.isError ?? false} />
      </div>)}
    </section>}
    <section aria-label="Simulation summary" className="grid gap-4 border-b border-border pb-6 sm:grid-cols-3">
      <div><p className="text-xs uppercase text-muted-foreground">Simulated cancellations</p><p className="board mt-2 text-3xl text-destructive">{cancelled.length}</p></div>
      <div><p className="text-xs uppercase text-muted-foreground">Affected demo passengers</p><p className="board mt-2 text-3xl">{cancelled.reduce((sum, f) => sum + f.passengers.length, 0)}</p></div>
      <div><p className="text-xs uppercase text-muted-foreground">Passenger acknowledgements</p><p className="board mt-2 text-3xl text-primary">{state.acknowledged.length}/{state.notifications.length}</p></div>
    </section>
    <section className="space-y-4" aria-label="Passenger activity">
      <div><h2 className="text-xl font-semibold">Passenger activity</h2><p className="text-sm text-muted-foreground">Demo passengers · bookings unconfirmed · vouchers are simulation only</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground"><tr>{['Passenger', 'Flight', 'Booking status', 'Notification', 'Time'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{state.notifications.map(n => <tr key={n.id} className="border-t border-border">
          <td className="p-2">{n.passenger.name}<span className="block text-xs text-muted-foreground">Demo passenger</span></td>
          <td className="board p-2">{n.aircraft.callsign || n.aircraft.id}</td>
          <td className="p-2">{n.cancelled ? 'Awaiting alternative itinerary' : 'Booking restored'}</td>
          <td className="p-2 text-primary">{state.acknowledged.includes(n.id) ? 'Acknowledged' : 'In passenger inbox'}</td>
          <td className="p-2 text-muted-foreground">{new Date(n.at).toLocaleTimeString('en-GB')}</td>
        </tr>)}{!state.notifications.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No passenger activity yet.</td></tr>}</tbody>
      </table></div>
    </section>
  </main>;
}
