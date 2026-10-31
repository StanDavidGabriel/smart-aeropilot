package ro.aeropilot.reroute;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Domain types + loading from network.json. Times are minutes after midnight. */
public final class Model {
    private Model() {}

    public record Airport(String code, String name, String city, double lat, double lon) {}

    public record Flight(String id, String from, String to, int depart, int arrive, int seatsAvailable, String airline) {}

    public record Passenger(String id, String name, String flight, boolean tightConnection, int familySize, Integer deadline) {}

    public record Itinerary(List<Flight> legs, double cost) {
        public int departure() { return legs.get(0).depart(); }
        public int arrival() { return legs.get(legs.size() - 1).arrive(); }
        public int stops() { return legs.size() - 1; }
        public String key() { return String.join(">", legs.stream().map(Flight::id).toList()); }
    }

    public record Network(List<Airport> airports, List<Flight> flights, List<Passenger> passengers,
                          int minConnection, int connectionPenalty, int maxStops) {}

    public static int toMin(String hhmm) {
        String[] p = hhmm.split(":");
        return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
    }

    public static String toHm(int m) { return String.format("%02d:%02d", m / 60, m % 60); }

    @SuppressWarnings("unchecked")
    public static Network load(String json) {
        Map<String, Object> root = (Map<String, Object>) Json.parse(json);
        List<Airport> airports = new ArrayList<>();
        for (Object o : (List<Object>) root.get("airports")) {
            Map<String, Object> a = (Map<String, Object>) o;
            airports.add(new Airport((String) a.get("code"), (String) a.get("name"), (String) a.get("city"),
                    ((Number) a.get("lat")).doubleValue(), ((Number) a.get("lon")).doubleValue()));
        }
        List<Flight> flights = new ArrayList<>();
        for (Object o : (List<Object>) root.get("flights")) {
            Map<String, Object> f = (Map<String, Object>) o;
            flights.add(new Flight((String) f.get("id"), (String) f.get("from"), (String) f.get("to"),
                    toMin((String) f.get("depart")), toMin((String) f.get("arrive")),
                    ((Number) f.get("seats_available")).intValue(), (String) f.get("airline")));
        }
        List<Passenger> passengers = new ArrayList<>();
        for (Object o : (List<Object>) root.get("passengers")) {
            Map<String, Object> p = (Map<String, Object>) o;
            Object d = p.get("deadline");
            passengers.add(new Passenger((String) p.get("id"), (String) p.get("name"), (String) p.get("flight"),
                    Boolean.TRUE.equals(p.get("tight_connection")), ((Number) p.get("family_size")).intValue(),
                    d == null ? null : toMin((String) d)));
        }
        Map<String, Object> def = (Map<String, Object>) root.get("defaults");
        return new Network(airports, flights, passengers,
                ((Number) def.get("min_connection_minutes")).intValue(),
                ((Number) def.get("connection_penalty_minutes")).intValue(),
                ((Number) def.get("max_stops")).intValue());
    }

    public static Map<String, Object> flightJson(Flight f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", f.id()); m.put("from", f.from()); m.put("to", f.to());
        m.put("depart", toHm(f.depart())); m.put("arrive", toHm(f.arrive()));
        m.put("seats_available", f.seatsAvailable()); m.put("airline", f.airline());
        return m;
    }

    public static Map<String, Object> itineraryJson(Itinerary it) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("legs", it.legs().stream().map(Model::flightJson).toList());
        m.put("depart", toHm(it.departure()));
        m.put("arrive", toHm(it.arrival()));
        m.put("stops", it.stops());
        m.put("cost", it.cost());
        return m;
    }
}
