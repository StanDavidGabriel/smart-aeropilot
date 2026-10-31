"""HTTP API (standard library only).
Usage: python -m reroute.server [path/to/network.json] [port]"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from . import messages, network, recommendations, support
from .live_flights import LiveFlights
from .simulation import Simulation

MAX_BODY = 1_000_000
HERE = os.path.dirname(os.path.abspath(__file__))


def make_handler(raw_network: str, engine: network.RerouteEngine, live: LiveFlights, sim: Simulation):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _send(self, status: int, payload):
            body = b"" if status == 204 else (payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if body:
                self.wfile.write(body)

        def _body(self) -> dict:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                raise OverflowError
            data = json.loads(self.rfile.read(length).decode("utf-8") or "null")
            if not isinstance(data, dict):
                raise ValueError("Expected a JSON object")
            return data

        def do_OPTIONS(self):
            self._send(204, "")

        def do_GET(self):
            url = urlparse(self.path)
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            now = datetime.now(timezone.utc)
            p = url.path
            if p == "/api/reroute/health":
                return self._send(200, {"ok": True, "engine": "python"})
            if p == "/api/reroute/network":
                return self._send(200, raw_network)
            if p == "/api/reroute/live-flights":
                try:
                    page = int(q.get("page", "0"))
                    if not 0 <= page <= 100000:
                        raise ValueError
                except ValueError:
                    return self._send(400, {"error": "Invalid flight query"})
                snap = live.snapshot(q.get("search", ""), q.get("airport", ""), page)
                if snap is None:
                    return self._send(503, {"error": "Waiting for AeroDataBox; configure server environment credentials"})
                return self._send(200, snap)
            if p == "/api/reroute/simulation":
                return self._send(200, sim.state())
            if p == "/api/reroute/simulation/options":
                fid = q.get("flightId")
                flight = sim.flight(fid)
                if flight is None or fid not in sim.cancelled_ids():
                    return self._send(404, {"error": "Flight is not simulated as cancelled"})
                return self._send(200, sim.support(flight, live.eligible_flights(now), now))
            if p.startswith("/api/reroute/"):
                return self._send(405, {})
            self._send(404, {"error": "Not found"})

        def do_POST(self):
            p = urlparse(self.path).path
            now = datetime.now(timezone.utc)
            try:
                req = self._body()
            except OverflowError:
                return self._send(413, {})
            except Exception:
                return self._send(400, {"error": "Invalid JSON body"})
            try:
                if p in ("/api/reroute/recommendations", "/api/reroute/support"):
                    flight, candidates, excluded = req["flight"], req["candidates"], set(req["excluded"])
                    routes = recommendations.itineraries(flight, candidates, excluded, now)
                    if p.endswith("recommendations"):
                        return self._send(200, routes)
                    return self._send(200, {"itineraries": routes, "voucher": support.voucher(flight, len(routes), now)})
                if p == "/api/reroute/cancel":
                    try:
                        return self._send(200, engine.cancel(req.get("flightId")))
                    except ValueError as e:
                        return self._send(400, {"error": str(e)})
                if p in ("/api/reroute/simulation/cancel", "/api/reroute/simulation/restore"):
                    fid = str(req.get("flightId"))
                    cancel = p.endswith("cancel")
                    flight = (live.find(fid) if cancel else None) or sim.flight(fid)
                    if flight is None:
                        return self._send(404, {"error": "Unknown flight"})
                    changed = sim.update(flight, cancel, now)
                    if not changed and cancel and fid not in sim.cancelled_ids():
                        return self._send(409, {"error": "Flight cannot be simulated as cancelled (departed, ineligible or outside 24h)"})
                    return self._send(200, {"changed": changed, "state": sim.state()})
                if p == "/api/reroute/notifications/ack":
                    sim.acknowledge(str(req.get("id")))
                    return self._send(200, sim.state())
                if p == "/api/reroute/notifications/clear":
                    sim.clear_notifications()
                    return self._send(200, sim.state())
                if p == "/api/reroute/message":
                    return self._send(200, messages.generate(req["cancelled"], req["result"]))
            except Exception:
                return self._send(400, {"error": "Invalid input"})
            self._send(404, {"error": "Not found"})

    return Handler


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    data = argv[0] if argv else os.path.join(HERE, "..", "data", "network.json")
    port = int(argv[1]) if len(argv) > 1 else 8081
    with open(data, encoding="utf-8") as fh:
        raw = fh.read()
    engine = network.RerouteEngine(network.load(raw))
    live = LiveFlights()
    live.start()
    sim_file = os.environ.get("REROUTE_SIMULATION_FILE", "simulation-state.json")
    sim = Simulation(sim_file.strip() or None)
    server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(raw, engine, live, sim))
    print(f"Reroute engine (Python) on http://localhost:{port} using {os.path.abspath(data)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
