"""Sample-network model, time-dependent Dijkstra and passenger priority/voucher rules.
Times are minutes after midnight."""
from __future__ import annotations

import heapq
import math
import itertools
import json
from dataclasses import dataclass


def to_min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def to_hm(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


@dataclass(frozen=True)
class Flight:
    id: str
    origin: str
    to: str
    depart: int
    arrive: int
    seats_available: int
    airline: str


@dataclass(frozen=True)
class Passenger:
    id: str
    name: str
    flight: str
    tight_connection: bool
    family_size: int
    deadline: int | None


@dataclass
class Network:
    airports: list
    flights: list[Flight]
    passengers: list[Passenger]
    min_connection: int
    connection_penalty: int
    max_stops: int


def load(raw: str) -> Network:
    root = json.loads(raw)
    flights = [Flight(f["id"], f["from"], f["to"], to_min(f["depart"]), to_min(f["arrive"]), int(f["seats_available"]), f["airline"]) for f in root["flights"]]
    passengers = [Passenger(p["id"], p["name"], p["flight"], p.get("tight_connection") is True, int(p["family_size"]),
                            None if p.get("deadline") is None else to_min(p["deadline"])) for p in root["passengers"]]
    d = root["defaults"]
    return Network(root["airports"], flights, passengers, int(d["min_connection_minutes"]), int(d["connection_penalty_minutes"]), int(d["max_stops"]))


def flight_json(f: Flight) -> dict:
    return {"id": f.id, "from": f.origin, "to": f.to, "depart": to_hm(f.depart), "arrive": to_hm(f.arrive),
            "seats_available": f.seats_available, "airline": f.airline}


def itinerary_json(legs: list[Flight], cost: float) -> dict:
    return {"legs": [flight_json(l) for l in legs], "depart": to_hm(legs[0].depart), "arrive": to_hm(legs[-1].arrive),
            "stops": len(legs) - 1, "cost": float(cost)}


class Router:
    """Dijkstra over (airport, arrival time). Cost = final arrival + penalty per connection; top-K distinct itineraries."""

    def __init__(self, flights, min_connection, connection_penalty, max_stops):
        self.by_origin: dict[str, list[Flight]] = {}
        for f in flights:
            self.by_origin.setdefault(f.origin, []).append(f)
        self.min_connection, self.connection_penalty, self.max_stops = min_connection, connection_penalty, max_stops

    def top_k(self, origin, dest, earliest, seats_left, party_size, excluded, k):
        tie = itertools.count()
        pq = [(float(earliest), next(tie), origin, earliest, ())]
        settled: dict[str, int] = {}
        out, seen = [], set()
        while pq and len(out) < k:
            cost, _, airport, time, legs = heapq.heappop(pq)
            if airport == dest and legs:
                key = ">".join(l.id for l in legs)
                if key not in seen:
                    seen.add(key)
                    out.append((list(legs), cost))
                continue
            settled[airport] = settled.get(airport, 0) + 1
            if settled[airport] > k or len(legs) > self.max_stops:
                continue
            ready = time if not legs else time + self.min_connection
            for f in self.by_origin.get(airport, []):
                if f.id in excluded or f.depart < ready or seats_left.get(f.id, 0) < party_size:
                    continue
                if f.to == origin or any(l.origin == f.to for l in legs):
                    continue
                new_legs = legs + (f,)
                heapq.heappush(pq, (float(f.arrive + self.connection_penalty * (len(new_legs) - 1)), next(tie), f.to, f.arrive, new_legs))
        return out


def priority(p: Passenger) -> float:
    s = 0.0
    if p.tight_connection:
        s += 3
    if p.family_size > 1:
        s += 2 + 0.5 * p.family_size
    if p.deadline is not None:
        s += 3 + max(0, (20 * 60 - p.deadline) / 120.0)
    return math.floor(s * 10 + 0.5) / 10.0


def voucher(delay_minutes: int | None) -> tuple[int, int]:
    """delay > 3h → 250 EUR, > 2h → 125 EUR; meal 15 EUR when > 1h. No route → 250 + meal."""
    if delay_minutes is None:
        return 250, 15
    comp = 250 if delay_minutes > 180 else 125 if delay_minutes > 120 else 0
    return comp, 15 if delay_minutes > 60 else 0


class RerouteEngine:
    def __init__(self, net: Network):
        self.net = net

    def cancel(self, flight_id: str) -> dict:
        cancelled = next((f for f in self.net.flights if f.id == flight_id), None)
        if cancelled is None:
            raise ValueError(f"Unknown flight {flight_id}")
        seats = {f.id: f.seats_available for f in self.net.flights}
        router = Router(self.net.flights, self.net.min_connection, self.net.connection_penalty, self.net.max_stops)
        affected = sorted((p for p in self.net.passengers if p.flight == flight_id), key=lambda p: (-priority(p), p.id))
        results = []
        for p in affected:
            options = router.top_k(cancelled.origin, cancelled.to, cancelled.depart, seats, p.family_size, {flight_id}, 3)
            chosen = options[0] if options else None
            delay = None
            if chosen:
                for l in chosen[0]:
                    seats[l.id] = seats.get(l.id, 0) - p.family_size
                delay = chosen[0][-1].arrive - cancelled.arrive
            comp, meal = voucher(delay)
            results.append({
                "passenger": {"id": p.id, "name": p.name, "flight": p.flight, "tight_connection": p.tight_connection,
                              "family_size": p.family_size, "deadline": None if p.deadline is None else to_hm(p.deadline)},
                "priority": priority(p),
                "options": [itinerary_json(*o) for o in options],
                "chosen": itinerary_json(*chosen) if chosen else None,
                "delay_minutes": delay,
                "voucher": {"compensation": comp, "meal": meal, "total": comp + meal, "code": f"AP-{p.id}-{flight_id}"},
                "status": "rebooked" if chosen else "unrouted",
            })
        return {"cancelled": flight_json(cancelled), "engine": "python", "results": results}
