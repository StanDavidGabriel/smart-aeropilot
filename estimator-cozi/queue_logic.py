"""Reguli pure pentru estimarea timpului; nu se salvează istoric."""
from dataclasses import dataclass, field
from math import hypot

EXTRA_SECONDS = {'backpack': 120, 'suitcase': 90, 'laptop': 60, 'handbag': 30}
LABELS = {'person': 'Persoană', 'backpack': 'Rucsac', 'suitcase': 'Valiză', 'laptop': 'Laptop', 'handbag': 'Geantă'}
COCO = {0: 'person', 24: 'backpack', 26: 'handbag', 28: 'suitcase', 63: 'laptop'}
BASE_SECONDS = 30
LANES = 3

@dataclass
class Box:
    x: float
    y: float
    w: float
    h: float
    score: float
    kind: str

@dataclass
class Person:
    box: Box
    lane: int
    items: list[str] = field(default_factory=list)

def assign_items(boxes, lanes=LANES):
    people = [Person(b, max(0, min(lanes - 1, int((b.x + b.w / 2) * lanes)))) for b in boxes if b.kind == 'person']
    for item in boxes:
        if item.kind == 'person' or not people:
            continue
        def distance(p):
            return hypot((item.x + item.w / 2 - p.box.x - p.box.w / 2) / max(p.box.w, .01),
                         (item.y + item.h / 2 - p.box.y - p.box.h / 2) / max(p.box.h, .01))
        nearest = min(people, key=distance)
        if distance(nearest) < 1.5:
            nearest.items.append(item.kind)
    return people

def person_extra_seconds(items):
    return sum(EXTRA_SECONDS[k] for k in items)

def fused_count(yolo, thermal):
    return .7 * yolo + .3 * thermal

def lane_wait_seconds(people, thermal):
    return fused_count(len(people), thermal) * BASE_SECONDS + sum(person_extra_seconds(p.items) for p in people)

def smooth(previous, current, alpha=.15):
    return current if previous is None else previous + alpha * (current - previous)

def level(minutes):
    return 'Fluent' if minutes < 5 else 'Moderat' if minutes < 12 else 'Aglomerat'
