package ro.aeropilot.reroute;

import ro.aeropilot.reroute.Model.Flight;
import ro.aeropilot.reroute.Model.Itinerary;

import java.util.*;

/**
 * Time-dependent Dijkstra over (airport, arrival_time) states.
 * Edge = flight departing at/after (arrival + MCT) with enough seats.
 * Cost = arrival time at destination + penalty per connection.
 * Each airport may be settled up to K times so we get the top-K distinct itineraries.
 */
public final class Router {
    private final Map<String, List<Flight>> byOrigin = new HashMap<>();
    private final int minConnection;
    private final int connectionPenalty;
    private final int maxStops;

    public Router(Collection<Flight> flights, int minConnection, int connectionPenalty, int maxStops) {
        for (Flight f : flights) byOrigin.computeIfAbsent(f.from(), k -> new ArrayList<>()).add(f);
        this.minConnection = minConnection;
        this.connectionPenalty = connectionPenalty;
        this.maxStops = maxStops;
    }

    private record Label(String airport, int time, List<Flight> legs, double cost) {}

    /**
     * @param earliest     passenger is available at origin from this minute (no MCT on first leg)
     * @param seatsLeft    live seat counter by flight id
     * @param partySize    seats required on every leg
     * @param excluded     flight ids that may not be used (e.g. the cancelled one)
     */
    public List<Itinerary> topK(String origin, String dest, int earliest, Map<String, Integer> seatsLeft,
                                int partySize, Set<String> excluded, int k) {
        PriorityQueue<Label> pq = new PriorityQueue<>(Comparator.comparingDouble(Label::cost));
        pq.add(new Label(origin, earliest, List.of(), earliest));
        Map<String, Integer> settled = new HashMap<>();
        List<Itinerary> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        while (!pq.isEmpty() && out.size() < k) {
            Label cur = pq.poll();
            if (cur.airport().equals(dest) && !cur.legs().isEmpty()) {
                Itinerary it = new Itinerary(cur.legs(), cur.cost());
                if (seen.add(it.key())) out.add(it);
                continue;
            }
            int count = settled.merge(cur.airport(), 1, Integer::sum);
            if (count > k) continue;
            if (cur.legs().size() > maxStops) continue; // already used max legs

            int ready = cur.legs().isEmpty() ? cur.time() : cur.time() + minConnection;
            for (Flight f : byOrigin.getOrDefault(cur.airport(), List.of())) {
                if (excluded.contains(f.id()) || f.depart() < ready) continue;
                if (seatsLeft.getOrDefault(f.id(), 0) < partySize) continue;
                boolean revisits = f.to().equals(origin) || cur.legs().stream().anyMatch(l -> l.from().equals(f.to()));
                if (revisits) continue;
                List<Flight> legs = new ArrayList<>(cur.legs());
                legs.add(f);
                double cost = f.arrive() + connectionPenalty * (legs.size() - 1);
                pq.add(new Label(f.to(), f.arrive(), List.copyOf(legs), cost));
            }
        }
        return out;
    }
}
