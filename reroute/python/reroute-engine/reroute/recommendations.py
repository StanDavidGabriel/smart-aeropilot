"""Schedule suggestions, never bookings. Mirrors ScheduleRecommendations.java."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from . import support
from .core import eligible, fmt_instant, hub_code, parse_instant

_HOUR = timedelta(hours=1)


def simulated_onward(destination, now: datetime) -> list[dict]:
    """Fictional hourly FRA/VIE/AMS → destination services (2h). Never enter the live feed."""
    if destination is None or destination == "OTP":
        return []
    rows = []
    start = now.replace(minute=0, second=0, microsecond=0) + _HOUR
    for i, origin in enumerate(["FRA", "VIE", "AMS"]):
        if origin == destination:
            continue
        at = start
        while at <= now + 24 * _HOUR:
            dep = fmt_instant(at)
            rows.append({
                "id": f"sim:{origin}:{destination}:{dep}", "callsign": f"SIM{i + 1}{at.astimezone(timezone.utc).hour:02d}",
                "origin": origin, "destination": destination, "scheduledDeparture": dep,
                "scheduledArrival": fmt_instant(at + 2 * _HOUR), "scheduleSource": "simulated",
                "officialStatus": "Scheduled", "airline": "Simulated European network", "country": "",
                "latitude": None, "longitude": None, "speed": None, "altitude": None, "onGround": True,
            })
            at += _HOUR
    return rows


def _same(a, b) -> bool:
    return hub_code(a) == hub_code(b)


def itineraries(cancelled: dict, candidates: list[dict], excluded: set, now: datetime) -> list[dict]:
    """Up to three itineraries: direct first, then earliest final arrival. Connections need ≥45 min."""
    departure = parse_instant(cancelled.get("scheduledDeparture"))
    if departure is None:
        return []
    unique: dict[str, dict] = {}
    for a in candidates:
        if a.get("id") != cancelled.get("id") and str(a.get("id")) not in excluded and eligible(a, now):
            unique[str(a.get("id"))] = a
    routes = []
    for first in unique.values():
        first_dep = parse_instant(first.get("scheduledDeparture"))
        if not _same(first.get("origin"), cancelled.get("origin")) or not first_dep > departure:
            continue
        if _same(first.get("destination"), cancelled.get("destination")):
            routes.append([first])
            continue
        arrival = parse_instant(first.get("scheduledArrival"))
        if arrival is None or not arrival > first_dep:
            continue
        for second in unique.values():
            if first.get("id") == second.get("id") or not _same(first.get("destination"), second.get("origin")) or not _same(second.get("destination"), cancelled.get("destination")):
                continue
            if parse_instant(second.get("scheduledDeparture")) < arrival + timedelta(minutes=45):
                continue
            routes.append([first, second])

    def key(route):
        last = route[-1]
        end = last.get("scheduledArrival") or last.get("scheduledDeparture")
        return (len(route), parse_instant(end), str(route[0].get("id")))

    return [{"legs": r, "fareEstimate": support.estimate(r)} for r in sorted(routes, key=key)[:3]]


def recommend(cancelled: dict, candidates: list[dict], excluded: set, now: datetime) -> list[dict]:
    """Up to three later direct flights on the same route."""
    departure = parse_instant(cancelled.get("scheduledDeparture"))
    if departure is None:
        return []
    unique: dict[str, dict] = {}
    for c in candidates:
        cid = str(c.get("id"))
        if cid == cancelled.get("id") or cid in excluded or not eligible(c, now):
            continue
        if not _same(c.get("origin"), cancelled.get("origin")) or not _same(c.get("destination"), cancelled.get("destination")):
            continue
        if not parse_instant(c.get("scheduledDeparture")) > departure:
            continue
        unique[cid] = c
    return sorted(unique.values(), key=lambda a: (parse_instant(a.get("scheduledDeparture")), str(a.get("id"))))[:3]
