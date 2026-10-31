# AeroPilot Reroute Engine (Java 17, zero dependencies)

Time-dependent Dijkstra re-routing, passenger priority and voucher rules.

## Run
```bash
cd java/reroute-engine
mvn package && java -jar target/reroute-engine.jar ../../src/data/network.json 8081
# or without Maven:
javac -d out $(find src -name '*.java') && java -cp out ro.aeropilot.reroute.RerouteServer ../../src/data/network.json 8081
```

## API
- `GET  /api/reroute/health`
- `GET  /api/reroute/network`
- `GET  /api/reroute/live-flights` — AeroDataBox airport schedules and airline status.
- `POST /api/reroute/recommendations` — `{ flight, candidates, excluded }` → up to three `{ legs: [...] }` itineraries, direct routes first, then earliest final arrival; each leg must exist in the supplied list. Connections require known first-leg arrival and at least 45 minutes. No seat or booking guarantee; an identical TS fallback is used when Java is offline.
- `POST /api/reroute/support` — same input, returns `{ itineraries, voucher }`; itineraries include `fareEstimate` and the voucher decision is evaluated against the server clock, never a caller-supplied timestamp.
- `POST /api/reroute/cancel` body `{"flightId":"AP103"}` → `{ cancelled, engine:"java", results:[...] }`

The website calls `VITE_REROUTE_API_URL` (default `http://localhost:8081`).
If the Java engine is unreachable, it uses `src/modules/reroute/router.ts`, a 1:1 TypeScript mirror
(covered by `router.test.ts`, which asserts the same assignments as Java).

## AeroDataBox live flights
The Java service fetches AeroDataBox on startup and every ten minutes, retaining the last successful snapshot on errors.
Coverage is fixed to OTP departures to curated European hubs, departing strictly in the future and within 24 hours. Departed, airborne, arrived, officially cancelled, unknown-status and actual-departure records cannot be simulated as cancellations. Provider windows are two 12-hour departure-only requests, excluding cargo, private flights and duplicate codeshares.
Legacy worldwide activation flags no longer enable extra airport fetching. Ten-minute polling uses approximately 288 flight requests per day per refresher; check your AeroDataBox RapidAPI subscription allowance and API-unit pricing.
Hosted calls use the linked Lovable connector gateway with server-only credentials.
For standalone Java on your laptop, set `RAPIDAPI_KEY` privately in your process environment before starting the service. Never commit credentials or put them in browser configuration.
Alternatively Java can use the gateway when both `UDC_AERODATABOX_API_KEY` and `LOVABLE_API_KEY` are supplied privately in its server environment.

Flight IDs combine flight number, route and scheduled movement timestamp, separating different days and preserving simulations across status updates.
The live board shows scheduled routes and official airline status separately from browser-local simulated cancellations.
Simulations notify three synthetic demo passengers; no real passenger messages or bookings are changed.
Live-flight scenarios combine real OTP departures with clearly labelled simulated onward services from FRA, VIE and AMS. Simulated hourly departures and two-hour durations are fictional hackathon data, not provider observations. They stay outside the live board and database snapshots, add no provider calls, and are mirrored by Java's `simulatedOnward` generator. Each recommendation labels its real and simulated legs. Suggestions survive reload but do not assign seats or confirm bookings.
The existing Java Dijkstra simulation continues to use the sample network and manifests.

## Scheduled-flight demo fares and vouchers
`SupportPolicy.java` and `src/modules/reroute/supportPolicy.ts` implement identical distance-based estimates: each leg adds USD 40 plus USD 0.10 per great-circle kilometre, with an indicative range of 80–140% of that total, rounded to whole dollars. These are per-passenger demo estimates, not live ticket quotes; baggage and fees are excluded. Unsupported airport coordinates produce no estimate.

Only a successful schedule check with no alternative qualifies for fallback support. Elapsed disruption starts at the original scheduled departure, not when Ops clicks cancel. No voucher before eight hours; USD 25 from eight hours, USD 50 from twelve hours. The passenger and Ops views re-evaluate time every minute. Pending or failed checks never qualify. Vouchers are non-redeemable simulation outcomes, not statutory compensation. The standalone legacy sample-network voucher rules remain separate.

Fare API research found limited free trials at FlightAPI.io and Ignav, and test-versus-production restrictions at Amadeus; no ready-to-use ongoing free production integration was verified. This fallback adds no provider calls or credentials.

The hosted preview uses Lovable Cloud's `reroute_live_snapshots` table and an authenticated scheduled callback at
`/api/public/reroute/refresh`. The existing ten-minute schedule is retained; hosted callbacks require publication.
Local development attempts the Java endpoint first, then the Cloud snapshot. Reloading the board reads the latest stored snapshot, not a new paid provider request.
The Refresh flights button requests an AeroDataBox update for signed-in app users and then reloads schedules and recommendations. Signed-out visitors can only reload the latest saved data; the button reports that distinction. This project currently has no sign-in flow, so signed-in button checks remain unavailable. Managed automatic updates require publication; manual refresh never exposes the cron credential.
Attribution: [AeroDataBox](https://aerodatabox.com), [RapidAPI documentation](https://rapidapi.com/aedbx-aedbx/api/aerodatabox).

## Merging into the main site
Copy these, nothing else:
- `java/reroute-engine/` (Java service)
- `src/modules/reroute/` (types, events, client, UI components, AI message function)
- `src/data/network.json`
- `src/routes/ops.reroute.tsx`, `src/routes/passenger.tsx`
- Packages: `ai`, `@ai-sdk/openai`
- For hosted live flights also copy `src/routes/api/public/reroute/refresh.ts`, the live-snapshot migration,
  and provide the team's Cloud client/cron authentication adapters; recreate the ten-minute job in their project.
  Link the team's AeroDataBox connector and keep credentials server-only. Local-only live flights use the Java service without a Cloud scheduler.

Events: `CancelEvent { flightId }` in, `RerouteEvent { cancelled, result, message }` out, via
`publish/subscribe` in `src/modules/reroute/events.ts` — swap that file for the team's shared bus.
