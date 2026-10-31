"""Server-side cancellation simulation. Synthetic recipients only; never changes real flights, bookings or vouchers.
Keeps stable JSON field names so saved state files stay compatible."""
from __future__ import annotations

import json
import os
import sys
import threading
from datetime import datetime

from . import recommendations, support
from .core import eligible, epoch_ms, hub_code

MAX_NOTIFICATIONS = 150
NAMES = ["Alex Morgan", "Sam Taylor", "Jordan Lee"]


def demo_passengers(aircraft_id: str) -> list[dict]:
    return [{"id": f"demo-{aircraft_id}-{i + 1}", "name": n} for i, n in enumerate(NAMES)]


def message(name: str, label: str, cancelled: bool) -> str:
    first = name.split(" ")[0]
    if cancelled:
        return (f"Hi {first}, flight {label} has been cancelled in this simulation. We are checking later departures and estimated fares. "
                "If no route is found, a demo voucher may apply after 8 hours from scheduled departure: $25 USD, increasing to $50 after 12 hours. "
                "Suggested flights are not confirmed bookings and demo vouchers are not redeemable. This is a demo notification, not an airline cancellation.")
    return f"Hi {first}, the simulated cancellation of flight {label} has been withdrawn. Your demo booking is restored. The actual airline flight was never changed."


class Simulation:
    def __init__(self, file: str | None = None):
        self.file = file
        self.flights: dict = {}
        self.notifications: list = []
        self.acknowledged: list = []
        self._lock = threading.RLock()
        if file and os.path.exists(file):
            try:
                with open(file, encoding="utf-8") as fh:
                    s = json.load(fh)
                self.flights, self.notifications, self.acknowledged = dict(s["flights"]), list(s["notifications"]), list(s["acknowledged"])
            except Exception as e:
                print(f"Ignoring unreadable simulation file: {e}", file=sys.stderr)

    def update(self, aircraft: dict, cancelled: bool, now: datetime) -> bool:
        """False when nothing changed (ineligible flight or same state)."""
        with self._lock:
            fid = str(aircraft.get("id"))
            existing = self.flights.get(fid)
            if cancelled and not eligible(aircraft, now):
                return False
            if existing is None and not cancelled:
                return False
            if existing is not None and existing.get("cancelled") == cancelled:
                return False
            passengers = existing["passengers"] if existing else demo_passengers(fid)
            callsign = str(aircraft.get("callsign", "") or "")
            label = fid.upper() if not callsign.strip() else callsign
            at = epoch_ms(now)
            fresh = [{"id": f"{fid}-{at}-{str(cancelled).lower()}-{p['id']}", "aircraft": aircraft, "passenger": p,
                      "cancelled": cancelled, "at": at, "message": message(str(p["name"]), label, cancelled)} for p in passengers]
            self.flights[fid] = {"aircraft": aircraft, "cancelled": cancelled, "at": at, "passengers": passengers}
            self.notifications = (fresh + self.notifications)[:MAX_NOTIFICATIONS]
            self._save()
            return True

    def flight(self, fid) -> dict | None:
        with self._lock:
            e = self.flights.get(fid)
            return e["aircraft"] if e else None

    def cancelled_ids(self) -> set:
        with self._lock:
            return {fid for fid, e in self.flights.items() if e.get("cancelled") is True}

    def acknowledge(self, nid: str):
        with self._lock:
            if nid not in self.acknowledged:
                self.acknowledged.append(nid)
                self._save()

    def clear_notifications(self):
        """Clears the passenger inbox only; simulated cancellations stay active."""
        with self._lock:
            self.notifications, self.acknowledged = [], []
            self._save()

    def state(self) -> dict:
        with self._lock:
            return {"flights": dict(self.flights), "notifications": list(self.notifications), "acknowledged": list(self.acknowledged)}

    def support(self, aircraft: dict, live_candidates: list[dict], now: datetime) -> dict:
        candidates = list(live_candidates) + recommendations.simulated_onward(hub_code(aircraft.get("destination")), now)
        routes = recommendations.itineraries(aircraft, candidates, self.cancelled_ids(), now)
        return {"flight": aircraft, "itineraries": routes, "voucher": support.voucher(aircraft, len(routes), now)}

    def _save(self):
        if not self.file:
            return
        try:
            with open(self.file, "w", encoding="utf-8") as fh:
                json.dump(self.state(), fh, ensure_ascii=False)
        except Exception as e:
            print(f"Could not save simulation: {e}", file=sys.stderr)
