import json
from .airports import DATA
SCENARIOS = json.loads((DATA / "metar-replay.json").read_text())["scenarios"]

def get_replay(icao, scenario):
    config = SCENARIOS[scenario]
    flights = json.loads((DATA / "flights.json").read_text())
    rows = [dict(f, inboundDelayMin=config["inboundOverrides"].get(f["id"], f["inboundDelayMin"]))
            for f in flights if f["origin"] == icao or f["dest"] == icao]
    return rows, config["metars"]
