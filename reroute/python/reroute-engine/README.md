# AeroPilot Reroute Engine — Python (standard library only)

A Python port of `java/reroute-engine` with the **same endpoints, rules and JSON**, so a frontend can use either one.
Needs Python 3.10+; nothing to install.

## Run
```bash
cd python/reroute-engine
python -m reroute.server                    # uses data/network.json, port 8081
python -m reroute.server data/network.json 8081
# tests
python -m unittest discover -s tests
```

## Live flights (AeroDataBox)
Set your RapidAPI key privately before starting, never commit it:
```bash
export RAPIDAPI_KEY=...        # Windows PowerShell: $env:RAPIDAPI_KEY="..."
```
Alternatively `UDC_AERODATABOX_API_KEY` + `LOVABLE_API_KEY` use the Lovable connector gateway.
Without a key, everything works except `/api/reroute/live-flights` (503) and cancelling live flights.
Refreshes on startup and every ten minutes (two 12-hour OTP departure windows), keeping the last good snapshot on errors.

`LOVABLE_API_KEY` also enables AI-written passenger messages; otherwise a fixed template is used.
Simulation state is saved to `simulation-state.json` (`REROUTE_SIMULATION_FILE=` empty keeps it in memory). The file format matches the Java one.

## API (identical to Java; `health` reports `"engine":"python"`)
- `GET  /api/reroute/health`, `GET /api/reroute/network`
- `GET  /api/reroute/live-flights?search=&airport=&page=`
- `POST /api/reroute/recommendations` / `POST /api/reroute/support` `{ flight, candidates, excluded }`
- `POST /api/reroute/cancel` `{"flightId":"AP103"}` — sample-network Dijkstra rebooking
- `GET  /api/reroute/simulation`
- `POST /api/reroute/simulation/cancel` / `restore` `{"flightId"}`
- `GET  /api/reroute/simulation/options?flightId=`
- `POST /api/reroute/notifications/ack` `{"id"}`, `POST /api/reroute/notifications/clear`
- `POST /api/reroute/message` `{ cancelled, result }`

See `java/reroute-engine/README.md` for the full rules (eligibility, fares, USD 25/50 vouchers after 8/12 hours). Demo amounts are never bookings, redeemable vouchers or statutory compensation.

## Layout
- `reroute/core.py` — time parsing, hub codes, departure eligibility
- `reroute/support.py` — demo fares and vouchers
- `reroute/recommendations.py` — scheduled itineraries + simulated onward flights
- `reroute/network.py` — sample network, Dijkstra router, passenger priority
- `reroute/live_flights.py` — AeroDataBox polling
- `reroute/simulation.py` — simulated cancellations and passenger inbox
- `reroute/messages.py` — passenger SMS
- `reroute/server.py` — HTTP API
