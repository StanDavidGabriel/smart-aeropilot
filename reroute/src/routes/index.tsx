import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AeroPilot — Flight operations" },
      { name: "description", content: "Smart AeroPilot: AeroDataBox flight schedules and passenger cancellation simulations." },
      { property: "og:title", content: "AeroPilot — Flight operations" },
      { property: "og:description", content: "Live flight operations and English passenger notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="board text-xs uppercase text-primary">Smart AeroPilot System</p>
      <h1 className="max-w-2xl text-5xl font-bold">AeroPilot flight operations</h1>
      <div className="flex gap-3">
        <Button asChild size="lg"><Link to="/ops/reroute">Operations console</Link></Button>
        <Button asChild size="lg" variant="outline"><Link to="/passenger">Passenger inbox</Link></Button>
      </div>
    </main>
  );
}
