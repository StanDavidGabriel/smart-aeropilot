package ro.aeropilot.reroute;

import java.time.Instant;
import java.util.*;

/** TS mirror: recommendations.ts. Schedule suggestions, never bookings. */
public final class ScheduleRecommendations {
    /** TS mirror: simulatedSchedules.ts. Fictional schedules never enter the live feed. */
    public static List<Map<String, Object>> simulatedOnward(String destination, Instant now) {
        if (destination == null || destination.equals("OTP")) return List.of();
        List<Map<String, Object>> rows = new ArrayList<>();
        String[] hubs = {"FRA", "VIE", "AMS"};
        long hour = 3600000L;
        for (int i = 0; i < hubs.length; i++) {
            String origin = hubs[i];
            if (origin.equals(destination)) continue;
            for (long at = Math.floorDiv(now.toEpochMilli(), hour) * hour + hour; at <= now.toEpochMilli() + 24 * hour; at += hour) {
                String departure = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(java.time.ZoneOffset.UTC).format(Instant.ofEpochMilli(at));
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("id", "sim:" + origin + ":" + destination + ":" + departure);
                a.put("callsign", "SIM" + (i + 1) + String.format(java.util.Locale.ROOT, "%02d", Instant.ofEpochMilli(at).atOffset(java.time.ZoneOffset.UTC).getHour()));
                a.put("origin", origin); a.put("destination", destination); a.put("scheduledDeparture", departure);
                a.put("scheduledArrival", java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(java.time.ZoneOffset.UTC).format(Instant.ofEpochMilli(at + 2 * hour)));
                a.put("scheduleSource", "simulated"); a.put("officialStatus", "Scheduled"); a.put("airline", "Simulated European network");
                a.put("country", ""); a.put("latitude", null); a.put("longitude", null); a.put("speed", null); a.put("altitude", null); a.put("onGround", true);
                rows.add(a);
            }
        }
        return rows;
    }
    public static List<Map<String, Object>> itineraries(Map<String, Object> cancelled, List<Map<String, Object>> candidates, Set<String> excluded, Instant now) {
        Instant departure;
        try { departure = Instant.parse(String.valueOf(cancelled.get("scheduledDeparture"))); }
        catch (RuntimeException e) { return List.of(); }
        Map<String, Map<String, Object>> unique = new LinkedHashMap<>();
        for (var a : candidates) if (!Objects.equals(a.get("id"), cancelled.get("id")) && !excluded.contains(String.valueOf(a.get("id"))) && LiveFlights.eligible(a, now)) unique.put(String.valueOf(a.get("id")), a);
        List<List<Map<String, Object>>> routes = new ArrayList<>();
        for (var first : unique.values()) {
            if (!same(first.get("origin"), cancelled.get("origin")) || !Instant.parse(String.valueOf(first.get("scheduledDeparture"))).isAfter(departure)) continue;
            if (same(first.get("destination"), cancelled.get("destination"))) { routes.add(List.of(first)); continue; }
            Instant arrival;
            try { arrival = Instant.parse(String.valueOf(first.get("scheduledArrival"))); }
            catch (RuntimeException e) { continue; }
            if (!arrival.isAfter(Instant.parse(String.valueOf(first.get("scheduledDeparture"))))) continue;
            for (var second : unique.values()) {
                if (Objects.equals(first.get("id"), second.get("id")) || !same(first.get("destination"), second.get("origin")) || !same(second.get("destination"), cancelled.get("destination"))) continue;
                if (Instant.parse(String.valueOf(second.get("scheduledDeparture"))).isBefore(arrival.plusSeconds(45 * 60))) continue;
                routes.add(List.of(first, second));
            }
        }
        return routes.stream().sorted(Comparator.<List<Map<String, Object>>>comparingInt(List::size).thenComparing(route -> {
            var last = route.get(route.size() - 1);
            Object arrival = last.get("scheduledArrival");
            return Instant.parse(String.valueOf(arrival == null ? last.get("scheduledDeparture") : arrival));
        }).thenComparing(route -> String.valueOf(route.get(0).get("id")))).limit(3).map(route -> Map.<String, Object>of("legs", route, "fareEstimate", SupportPolicy.estimate(route))).toList();
    }
    private static boolean same(Object a, Object b) { return LiveFlights.hubCode(String.valueOf(a)).equals(LiveFlights.hubCode(String.valueOf(b))); }
    public static List<Map<String, Object>> recommend(Map<String, Object> cancelled, List<Map<String, Object>> candidates, Set<String> excluded, Instant now) {
        Instant departure;
        try { departure = Instant.parse(String.valueOf(cancelled.get("scheduledDeparture"))); }
        catch (RuntimeException e) { return List.of(); }
        Map<String, Map<String, Object>> unique = new HashMap<>();
        for (var candidate : candidates) {
            String id = String.valueOf(candidate.get("id"));
            if (id.equals(cancelled.get("id")) || excluded.contains(id) || !LiveFlights.eligible(candidate, now)) continue;
            if (!LiveFlights.hubCode(String.valueOf(candidate.get("origin"))).equals(LiveFlights.hubCode(String.valueOf(cancelled.get("origin")))) || !LiveFlights.hubCode(String.valueOf(candidate.get("destination"))).equals(LiveFlights.hubCode(String.valueOf(cancelled.get("destination"))))) continue;
            if (!Instant.parse(String.valueOf(candidate.get("scheduledDeparture"))).isAfter(departure)) continue;
            unique.put(id, candidate);
        }
        return unique.values().stream().sorted(Comparator.<Map<String, Object>, Instant>comparing(a -> Instant.parse(String.valueOf(a.get("scheduledDeparture")))).thenComparing(a -> String.valueOf(a.get("id")))).limit(3).toList();
    }
}