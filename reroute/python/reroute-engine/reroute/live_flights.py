"""AeroDataBox schedules and status only; never passenger manifests or bookable inventory.
OTP departures, two 12h departure windows, refreshed every ten minutes; keeps the last good snapshot on errors."""
from __future__ import annotations

import json
import os
import re
import sys
import threading
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from .core import HUBS, eligible, fmt_instant, hub_code, parse_instant

REFRESH_SECONDS = 600
PAGE_SIZE = 50


def _obj(v) -> dict:
    return v if isinstance(v, dict) else {}


def _airport(movement: dict) -> str:
    a = _obj(movement.get("airport"))
    return str(a.get("iata", a.get("icao", "Unknown")))


def _time(movement: dict) -> str | None:
    text = _obj(movement.get("scheduledTime")).get("utc")
    if not isinstance(text, str):
        return None
    iso = text.replace(" ", "T")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z", iso):
        iso = iso[:16] + ":00Z"
    dt = parse_instant(iso)
    return fmt_instant(dt) if dt else None


def _request(path: str) -> dict:
    connector, app, rapid = os.environ.get("UDC_AERODATABOX_API_KEY"), os.environ.get("LOVABLE_API_KEY"), os.environ.get("RAPIDAPI_KEY")
    gateway = bool(connector and app)
    if not gateway and not (rapid and rapid.strip()):
        raise RuntimeError("Configure private provider credentials (RAPIDAPI_KEY)")
    base = "https://connector-gateway.lovable.dev/udc_aerodatabox" if gateway else "https://aerodatabox.p.rapidapi.com"
    headers = {"X-RapidAPI-Host": "aerodatabox.p.rapidapi.com"}
    if gateway:
        headers.update({"Authorization": f"Bearer {app}", "X-Connection-Api-Key": connector})
    else:
        headers["X-RapidAPI-Key"] = rapid
    req = urllib.request.Request(base + path, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            if r.status == 204:
                return {"departures": [], "arrivals": []}
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"AeroDataBox HTTP {e.code}") from None


def parse_departures(departures: list, now: datetime, airport: str = "LROP") -> dict:
    """Turn raw AeroDataBox departure rows into eligible aircraft records keyed by flight ID."""
    flights = {}
    for row in departures:
        if not isinstance(row, dict) or not isinstance(row.get("number"), str):
            continue
        dep, arr = _obj(row.get("departure")), _obj(row.get("arrival"))
        origin = HUBS.get(airport, airport) if not _obj(dep.get("airport")) else _airport(dep)
        destination = _airport(arr)
        dep_time, arr_time = _time(dep), _time(arr)
        identity = dep_time or arr_time
        if identity is None:
            continue
        callsign = re.sub(r"\s", "", row["number"])
        fid = f"adb:{callsign}:{origin}:{destination}:{identity}"
        a = {"id": fid, "callsign": callsign, "country": "", "longitude": None, "latitude": None, "altitude": None,
             "speed": None, "onGround": False, "origin": origin, "destination": destination,
             "scheduledDeparture": dep_time, "scheduledArrival": arr_time}
        actual = _time({"scheduledTime": _obj(dep.get("actualTime"))}) or _time({"scheduledTime": _obj(dep.get("runwayTime"))})
        if actual:
            a["actualDeparture"] = actual
        a["officialStatus"] = row.get("status", "Unknown")
        a["airline"] = _obj(row.get("airline")).get("name", "")
        if eligible(a, now):
            flights[fid] = a
    return flights


class LiveFlights:
    def __init__(self):
        self._snapshot: dict | None = None
        self._lock = threading.Lock()

    def start(self):
        def loop():
            while True:
                self.refresh()
                threading.Event().wait(REFRESH_SECONDS)
        threading.Thread(target=loop, name="aerodatabox-refresh", daemon=True).start()

    def set_snapshot(self, snapshot: dict):
        with self._lock:
            self._snapshot = snapshot

    def refresh(self):
        try:
            now = datetime.now(timezone.utc)
            departures = []
            for offset in (0, 720):
                part = _request(f"/flights/airports/icao/LROP?offsetMinutes={offset}&durationMinutes=720&direction=Departure"
                                "&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLeg=true")
                if not isinstance(part.get("departures"), list):
                    raise ValueError("Invalid AeroDataBox departures")
                departures.extend(part["departures"])
            flights = parse_departures(departures, now)
            stamp = fmt_instant(now)
            self.set_snapshot({"aircraft": list(flights.values()), "observedAt": stamp, "fetchedAt": stamp,
                               "coverage": {"supported": 1, "loaded": 1, "failed": 0, "stale": 0, "airports": ["LROP"], "enabled": True}})
        except Exception as e:  # keep previous snapshot
            print(f"AeroDataBox refresh failed; keeping previous snapshot: {e}", file=sys.stderr)

    def _aircraft(self) -> list[dict] | None:
        with self._lock:
            return None if self._snapshot is None else list(self._snapshot["aircraft"])

    def eligible_flights(self, now: datetime) -> list[dict]:
        rows = self._aircraft() or []
        return [a for a in rows if eligible(a, now) and hub_code(a.get("origin")) == "OTP"]

    def find(self, fid) -> dict | None:
        return next((a for a in (self._aircraft() or []) if fid is not None and a.get("id") == fid), None)

    def snapshot(self, search: str = "", airport: str = "", page: int = 0) -> dict | None:
        with self._lock:
            if self._snapshot is None:
                return None
            result = dict(self._snapshot)
        now = datetime.now(timezone.utc)
        rows = []
        for a in result["aircraft"]:
            if not eligible(a, now) or hub_code(a.get("origin")) != "OTP":
                continue
            text = f"{a.get('callsign')} {a.get('origin')} {a.get('destination')} {a.get('airline')}".lower()
            if search.lower() in text and (not airport or airport == a.get("origin") or HUBS.get(airport, airport) == a.get("origin")):
                rows.append(a)
        rows.sort(key=lambda a: str(a.get("id")))
        start = min(len(rows), max(0, page) * PAGE_SIZE)
        result.update(totalFlights=len(rows), pageSize=PAGE_SIZE, page=page, aircraft=rows[start:start + PAGE_SIZE])
        return result
