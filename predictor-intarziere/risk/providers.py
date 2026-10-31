"""Server-side provider calls. Never send credentials through public proxies."""
from datetime import datetime
import math
import threading
import time
import requests
from .airports import validate_airport

_cache = {}
_lock = threading.Lock()

def parse_time(value):
    if not value: return None
    try: return datetime.fromisoformat(value.replace(" ", "T").replace("Z", "+00:00"))
    except (ValueError, TypeError): return None

def map_departures(departures, icao):
    flights = []
    for i, f in enumerate(departures):
        dep, arr = f.get("departure") or {}, f.get("arrival") or {}
        scheduled = (dep.get("scheduledTime") or {}).get("utc")
        revised = (dep.get("revisedTime") or {}).get("utc")
        start, end = parse_time(scheduled), parse_time(revised)
        delay = max(0, math.floor((end-start).total_seconds()/60+.5)) if start and end else 0
        number = "".join((f.get("number") or f.get("callSign") or f"FL{i}").split())
        flights.append(dict(id=f"{icao}-{number}-{scheduled or i}-{i}", flightNo=number, origin=icao,
            dest=(arr.get("airport") or {}).get("icao") or "", std=scheduled.replace(" ", "T") if start else "",
            inboundDelayMin=180 if f.get("status") == "Canceled" else delay, congestion=.3, passengers=120))
    return sorted(flights, key=lambda f: f["std"])

def get_live_flights(icao, api_key):
    validate_airport(icao)
    if not api_key: return {"flights": [], "error": "Add your AeroDataBox RapidAPI key to enable live departures."}
    # Keep keys in server memory only; scope cached boards to each credential and airport.
    cache_key = (icao, api_key)
    with _lock:
        cached = _cache.get(cache_key)
    if cached and time.monotonic()-cached[0] < 600:
        return {"flights": cached[1], "error": None}
    try:
        params = dict(offsetMinutes=-60, durationMinutes=720, direction="Departure", withLeg="true",
                      withCancelled="true", withCodeshared="false", withCargo="true", withPrivate="true", withLocation="false")
        headers = {"X-RapidAPI-Key": api_key, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com"}
        url = f"https://aerodatabox.p.rapidapi.com/flights/airports/icao/{icao}"
        response = requests.get(url, params=params, headers=headers, timeout=25)
        if response.status_code == 429:
            time.sleep(3)
            response = requests.get(url, params=params, headers=headers, timeout=25)
        if response.status_code == 429:
            return {"flights": [], "error": "Provider request limit reached. Try again shortly."}
        if response.status_code in (401,403):
            return {"flights": [], "error": "Check your RapidAPI key and active AeroDataBox subscription."}
        response.raise_for_status()
        payload = {} if response.status_code == 204 else response.json()
        flights = map_departures(payload.get("departures") or [], icao)
        with _lock:
            if len(_cache) >= 50: _cache.clear()
            _cache[cache_key] = (time.monotonic(), flights)
        return {"flights": flights, "error": None}
    except (requests.RequestException, ValueError, TypeError):
        return {"flights": [], "error": "Live departures unavailable. Please try again."}

def get_live_metars(icaos):
    ids = list(dict.fromkeys(validate_airport(a) for a in icaos if a))
    metars = {}
    try:
        for start in range(0, len(ids), 40):
            batch = ids[start:start+40]
            response = requests.get("https://aviationweather.gov/api/data/metar", params={"ids": ",".join(batch), "format": "raw"},
                                    headers={"User-Agent": "craiova-python-risk"}, timeout=20)
            response.raise_for_status()
            for line in response.text.splitlines():
                raw = line.strip().removeprefix("METAR ").removeprefix("SPECI ")
                if raw[:4] in batch: metars.setdefault(raw[:4], raw)
    except requests.RequestException:
        pass
    return metars
