import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useSimulation } from '@/modules/reroute/useSimulation';
import { acknowledgeNotification, clearNotifications } from '@/modules/reroute/simulation';
import { useRecommendations } from '@/modules/reroute/useRecommendations';
import { ScheduledAlternatives } from '@/modules/reroute/components/ScheduledAlternatives';

export const Route = createFileRoute('/passenger')({
  head: () => ({ meta: [
    { title: 'Passenger notifications — AeroPilot' },
    { name: 'description', content: 'English cancellation and restoration notifications for simulated passenger bookings.' },
    { property: 'og:title', content: 'Passenger notifications — AeroPilot' },
    { property: 'og:description', content: 'View and acknowledge updates to your demo flight booking.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: PassengerFeed,
});

function PassengerFeed() {
  const state = useSimulation();
  const recommendations = useRecommendations(state);
  return <main className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-8">
    <header className="text-center"><p className="board text-xs uppercase text-primary">AeroPilot · Passenger</p><h1 className="text-3xl font-bold">Notifications</h1><p className="mt-2 text-sm text-muted-foreground">Demo passenger inbox · no messages sent to real travelers</p></header>
    <div className="flex flex-wrap justify-center gap-2">
      <Button variant="outline" asChild><Link to="/ops/reroute">Flight operations</Link></Button>
      <Button variant="outline" disabled={!state.notifications.length} onClick={() => clearNotifications()}>Clear all notifications</Button>
    </div>
    <div className="phone h-[720px] w-full max-w-[380px] overflow-hidden">
      <div className="board border-b border-border px-5 py-3 text-xs text-muted-foreground">AeroPilot · Passenger inbox</div>
      <div className="h-[660px] space-y-3 overflow-y-auto px-3 py-4">
        {!state.notifications.length && <p className="mt-24 text-center text-sm text-muted-foreground">No notifications yet.</p>}
        {state.notifications.map(n => <article key={n.id} className="animate-notif panel space-y-3 p-3">
          <header className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span className="text-primary">✈ AeroPilot · Simulation</span><time>{new Date(n.at).toLocaleTimeString('en-GB')}</time></header>
          <div><p className="font-semibold">{n.passenger.name}</p><p className={`board text-sm ${n.cancelled ? 'text-destructive' : 'text-success'}`}>{n.aircraft.callsign || n.aircraft.id} · {n.cancelled ? 'Simulated cancellation' : 'Booking restored'}</p></div>
          <p className="text-sm">{n.message}</p>
          {n.cancelled && state.flights[n.aircraft.id]?.cancelled && <ScheduledAlternatives aircraft={n.aircraft} flights={recommendations.get(n.aircraft.id)?.data} pending={recommendations.get(n.aircraft.id)?.isPending ?? true} error={recommendations.get(n.aircraft.id)?.isError ?? false} />}
          {n.cancelled && !state.flights[n.aircraft.id]?.cancelled && <p className="text-xs text-muted-foreground">This simulated cancellation has been restored.</p>}
          <Button className="w-full" disabled={state.acknowledged.includes(n.id)} onClick={() => acknowledgeNotification(n.id)}>{state.acknowledged.includes(n.id) ? 'Acknowledged ✓' : 'Acknowledge'}</Button>
        </article>)}
      </div>
    </div>
  </main>;
}
