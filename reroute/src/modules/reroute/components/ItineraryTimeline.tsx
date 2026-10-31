import type { Itinerary } from "../types";

export function ItineraryTimeline({ it, compact }: { it: Itinerary | null; compact?: boolean }) {
  if (!it) return <span className="text-sm text-destructive">No itinerary available</span>;
  return (
    <ol className={`flex flex-wrap items-center gap-1 board ${compact ? "text-xs" : "text-sm"}`}>
      {it.legs.map((l, i) => (
        <li key={l.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground">·</span>}
          <span className="rounded bg-secondary px-1.5 py-0.5">
            <span className="text-primary">{l.id}</span> {l.from} {l.depart}→{l.to} {l.arrive}
          </span>
        </li>
      ))}
    </ol>
  );
}
