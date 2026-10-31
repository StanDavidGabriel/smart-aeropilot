import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AeroPilot — Python rerouting service" },
      { name: "description", content: "AeroPilot now runs as a standalone Python service; the website will be rebuilt later." },
      { property: "og:title", content: "AeroPilot — Python rerouting service" },
      { property: "og:description", content: "Flight rerouting, simulated cancellations and passenger messages in Python." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs uppercase tracking-widest text-primary">Smart AeroPilot System</p>
      <h1 className="max-w-2xl text-4xl font-bold">The website is being rebuilt</h1>
      <p className="max-w-xl text-muted-foreground">
        All flight logic now runs in the Python service at python/reroute-engine. Start it locally and use its API on port 8081.
      </p>
    </main>
  );
}
