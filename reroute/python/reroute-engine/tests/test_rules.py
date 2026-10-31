"""Rule tests. Run: python -m unittest discover -s tests"""
import json
import os
import unittest
from datetime import timedelta

from reroute import network, recommendations as rec, support
from reroute.core import eligible, parse_instant
from reroute.simulation import Simulation

NOW = parse_instant("2026-10-31T12:10:00Z")
DATA = os.path.join(os.path.dirname(__file__), "..", "data", "network.json")


class DepartureRules(unittest.TestCase):
    def test_eligibility(self):
        f = {"origin": "OTP", "destination": "LHR", "officialStatus": "Expected", "scheduledDeparture": "2026-10-31T13:10:00Z"}
        self.assertTrue(eligible(f, NOW))
        self.assertFalse(eligible({**f, "destination": "JFK"}, NOW))
        for s in ["Departed", "EnRoute", "Airborne", "Arrived", "Canceled", "Unknown"]:
            self.assertFalse(eligible({**f, "officialStatus": s}, NOW), s)
        self.assertTrue(eligible({**f, "scheduledDeparture": "2026-11-01T12:10:00Z"}, NOW))
        self.assertFalse(eligible({**f, "scheduledDeparture": "2026-11-01T12:10:01Z"}, NOW))
        self.assertFalse(eligible({**f, "scheduledDeparture": "2026-10-31T12:10:00Z"}, NOW))
        self.assertFalse(eligible({**f, "actualDeparture": "2026-10-31T12:00:00Z"}, NOW))


class ScheduleRules(unittest.TestCase):
    def setUp(self):
        self.now = parse_instant("2026-10-31T12:22:00Z")
        self.original = {"id": "LO644", "origin": "OTP", "destination": "WAW", "officialStatus": "Expected", "scheduledDeparture": "2026-11-01T03:35:00Z"}

    def test_recommend(self):
        later = {**self.original, "id": "LO642", "scheduledDeparture": "2026-11-01T06:20:00Z"}
        self.assertEqual(rec.recommend(self.original, [self.original, later], {"LO644"}, self.now), [later])
        self.assertEqual(rec.recommend(self.original, [later], {"LO642"}, self.now), [])
        self.assertEqual(rec.recommend(self.original, [{**later, "officialStatus": "Departed"}], set(), self.now), [])

    def test_connections_need_45_minutes(self):
        first = {**self.original, "id": "OTP-FRA", "destination": "FRA", "scheduledDeparture": "2026-11-01T04:00:00Z", "scheduledArrival": "2026-11-01T06:00:00Z"}
        second = {**self.original, "id": "FRA-WAW", "origin": "FRA", "scheduledDeparture": "2026-11-01T06:45:00Z"}
        self.assertEqual(rec.itineraries(self.original, [first], set(), self.now), [])
        self.assertEqual(rec.itineraries(self.original, [first, second], set(), self.now)[0]["legs"], [first, second])
        second["scheduledDeparture"] = "2026-11-01T06:44:00Z"
        self.assertEqual(rec.itineraries(self.original, [first, second], set(), self.now), [])

    def test_simulated_onward(self):
        sim = rec.simulated_onward("WAW", self.now)
        self.assertEqual(len(sim), 72)
        self.assertTrue(all(a["scheduleSource"] == "simulated" and a["origin"] != "OTP" for a in sim))
        first = {**self.original, "id": "OTP-FRA", "destination": "FRA", "scheduledDeparture": "2026-11-01T04:00:00Z", "scheduledArrival": "2026-11-01T06:00:00Z"}
        self.assertTrue(rec.itineraries(self.original, sim + [first], set(), self.now))

    def test_fares_and_vouchers(self):
        self.assertEqual(support.estimate([self.original]), {"low": 106, "high": 185, "currency": "USD"})
        dep = parse_instant(self.original["scheduledDeparture"])
        self.assertEqual(support.voucher(self.original, 0, dep + timedelta(hours=8) - timedelta(milliseconds=1))["amount"], 0)
        self.assertEqual(support.voucher(self.original, 0, dep + timedelta(hours=8))["amount"], 25)
        self.assertEqual(support.voucher(self.original, 0, dep + timedelta(hours=12))["amount"], 50)
        self.assertEqual(support.voucher(self.original, 1, dep + timedelta(hours=24))["amount"], 0)


class SimulationRules(unittest.TestCase):
    def test_flow(self):
        flight = {"id": "adb:RO391:OTP:LHR:2026-10-31T14:00:00.000Z", "callsign": "RO391", "origin": "OTP", "destination": "LHR",
                  "officialStatus": "Expected", "scheduledDeparture": "2026-10-31T14:00:00.000Z"}
        sim = Simulation(None)
        self.assertTrue(sim.update(flight, True, NOW))
        self.assertIn(flight["id"], sim.cancelled_ids())
        self.assertEqual(len(sim.state()["notifications"]), 3)
        self.assertFalse(sim.update(flight, True, NOW))
        self.assertTrue(sim.update(flight, False, NOW + timedelta(minutes=1)))
        self.assertEqual(sim.cancelled_ids(), set())
        self.assertEqual(len(sim.state()["notifications"]), 6)
        self.assertFalse(sim.update({**flight, "id": "other", "officialStatus": "Departed"}, True, NOW))
        first = sim.state()["notifications"][0]["id"]
        sim.acknowledge(first)
        self.assertIn(first, sim.state()["acknowledged"])
        sim.update(flight, True, NOW)
        sim.clear_notifications()
        self.assertEqual(sim.state()["notifications"], [])
        self.assertIn(flight["id"], sim.cancelled_ids())
        self.assertEqual(support.voucher(flight, 0, parse_instant("2026-10-31T22:00:00Z"))["amount"], 25)
        self.assertEqual(support.voucher(flight, 0, parse_instant("2026-11-01T02:00:00Z"))["amount"], 50)


class SampleNetwork(unittest.TestCase):
    def test_cancel_ap103(self):
        with open(DATA, encoding="utf-8") as fh:
            out = network.RerouteEngine(network.load(fh.read())).cancel("AP103")
        self.assertEqual(out["cancelled"]["id"], "AP103")
        self.assertTrue(out["results"])
        with self.assertRaises(ValueError):
            network.RerouteEngine(network.load(json.dumps({"airports": [], "flights": [], "passengers": [],
                "defaults": {"min_connection_minutes": 45, "connection_penalty_minutes": 60, "max_stops": 2}}))).cancel("X")


if __name__ == "__main__":
    unittest.main()
