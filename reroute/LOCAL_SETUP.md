# Running AeroPilot Reroute locally

This archive contains the whole module: the website (TanStack Start + React) and the Java re-routing engine (`java/reroute-engine`).

## 1. Prerequisites

- **Node.js 20+** and npm (install with [nvm-windows](https://github.com/coreybutler/nvm-windows) or from nodejs.org)
- **JDK 17** (e.g. [Adoptium Temurin 17](https://adoptium.net)) — only needed for the Java engine
- Optional: **Maven** for the Java tests and runnable jar; otherwise plain `javac` works (JDK-only code, zero dependencies)

## 2. The website

```sh
# from the extracted folder
npm install
npm run dev
```

Open http://localhost:8080

- The `.env` file in this archive points the app at the project's cloud backend, so the saved flight snapshots and the Ops / passenger pages work out of the box.
- Pages: `/` (home), `/ops` (ops.reroute console), `/passenger` (passenger phone view).

Run the website tests with:

```sh
npm test
```

## 3. The Java engine (this is where Java runs)

From the extracted folder:

```sh
cd java/reroute-engine

# Option A — no Maven needed (Windows):
javac -d out src\main\java\ro\aeropilot\reroute\*.java
java -cp out ro.aeropilot.reroute.RerouteServer ..\..\src\data\network.json 8081

# Option B — with Maven:
mvn package
java -jar target/reroute-engine.jar ../../src/data/network.json 8081
```

The engine listens on http://localhost:8081 :

- `GET /api/reroute/health` — liveness check
- `GET /api/reroute/network` — the demo network
- `GET /api/reroute/live-flights` — AeroDataBox OTP departures (needs a key, see below)
- `POST /api/reroute/recommendations` — alternative itineraries
- `POST /api/reroute/support` — itineraries + fare estimate + voucher decision
- `POST /api/reroute/cancel` — the demo Dijkstra re-routing over the sample network

Run the Java tests:

```sh
mvn test
```

## 4. Live flights on your laptop

The hosted refresh route uses a server-only credential that is deliberately **not** in this archive. Locally, give the Java engine your own AeroDataBox (RapidAPI) key:

```sh
# Windows (PowerShell)
$env:RAPIDAPI_KEY = "your-rapidapi-key"
java -cp out ro.aeropilot.reroute.RerouteServer ..\..\src\data\network.json 8081
```

The engine polls AeroDataBox on startup and every ten minutes and keeps the last good snapshot on errors. Coverage is fixed to OTP departures within the next 24 hours. Never commit the key or put it in browser configuration.

## 5. How the pieces fit together

- The website tries the Java engine at `http://localhost:8081` first (override with `VITE_REROUTE_API_URL`), then falls back to the identical TypeScript mirror in `src/modules/reroute/router.ts` and stored cloud snapshots.
- Simulated cancellations, notifications, recommendations and voucher rules work fully in the browser even with no Java process running.
- See `java/reroute-engine/README.md` for the full API list and merge instructions.
