package ro.aeropilot.reroute;

import ro.aeropilot.reroute.Model.*;

import java.util.*;

/** Priority scoring, seat assignment and voucher rules for a CancelEvent. */
public final class RerouteEngine {
    private final Network net;

    public RerouteEngine(Network net) { this.net = net; }

    /** Higher = served first when seats are scarce. */
    public static double priority(Passenger p) {
        double s = 0;
        if (p.tightConnection()) s += 3;
        if (p.familySize() > 1) s += 2 + 0.5 * p.familySize();
        if (p.deadline() != null) s += 3 + Math.max(0, (20 * 60 - p.deadline()) / 120.0);
        return Math.round(s * 10) / 10.0;
    }

    /** Voucher rules: delay > 3h -> 250 EUR, > 2h -> 125 EUR, meal 15 EUR when delay > 1h. No route -> 250 EUR + meal. */
    public static int[] voucher(Integer delayMinutes) {
        if (delayMinutes == null) return new int[]{250, 15};
        int comp = delayMinutes > 180 ? 250 : delayMinutes > 120 ? 125 : 0;
        int meal = delayMinutes > 60 ? 15 : 0;
        return new int[]{comp, meal};
    }

    public Map<String, Object> cancel(String flightId) {
        Flight cancelled = net.flights().stream().filter(f -> f.id().equals(flightId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown flight " + flightId));
        Map<String, Integer> seats = new HashMap<>();
        for (Flight f : net.flights()) seats.put(f.id(), f.seatsAvailable());
        Router router = new Router(net.flights(), net.minConnection(), net.connectionPenalty(), net.maxStops());

        List<Passenger> affected = new ArrayList<>(net.passengers().stream().filter(p -> p.flight().equals(flightId)).toList());
        affected.sort(Comparator.comparingDouble(RerouteEngine::priority).reversed().thenComparing(Passenger::id));

        List<Object> results = new ArrayList<>();
        for (Passenger p : affected) {
            List<Itinerary> options = router.topK(cancelled.from(), cancelled.to(), cancelled.depart(), seats,
                    p.familySize(), Set.of(flightId), 3);
            Itinerary chosen = options.isEmpty() ? null : options.get(0);
            Integer delay = null;
            if (chosen != null) {
                for (Flight l : chosen.legs()) seats.merge(l.id(), -p.familySize(), Integer::sum);
                delay = chosen.arrival() - cancelled.arrive();
            }
            int[] v = voucher(delay);
            Map<String, Object> r = new LinkedHashMap<>();
            Map<String, Object> pj = new LinkedHashMap<>();
            pj.put("id", p.id()); pj.put("name", p.name()); pj.put("flight", p.flight());
            pj.put("tight_connection", p.tightConnection()); pj.put("family_size", p.familySize());
            pj.put("deadline", p.deadline() == null ? null : Model.toHm(p.deadline()));
            r.put("passenger", pj);
            r.put("priority", priority(p));
            r.put("options", options.stream().map(Model::itineraryJson).toList());
            r.put("chosen", chosen == null ? null : Model.itineraryJson(chosen));
            r.put("delay_minutes", delay);
            Map<String, Object> vj = new LinkedHashMap<>();
            vj.put("compensation", v[0]); vj.put("meal", v[1]); vj.put("total", v[0] + v[1]);
            vj.put("code", "AP-" + p.id() + "-" + flightId);
            r.put("voucher", vj);
            r.put("status", chosen == null ? "unrouted" : "rebooked");
            results.add(r);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("cancelled", Model.flightJson(cancelled));
        out.put("engine", "java");
        out.put("results", results);
        return out;
    }
}
