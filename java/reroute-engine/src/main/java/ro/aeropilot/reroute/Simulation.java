package ro.aeropilot.reroute;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

/**
 * Server-side cancellation simulation (replaces the old browser-local store).
 * Synthetic recipients only: AeroDataBox does not supply passenger manifests.
 * Never changes real airline flights, bookings or vouchers.
 */
public final class Simulation {
    private static final int MAX_NOTIFICATIONS = 150;
    private final Path file;
    private Map<String, Object> flights = new LinkedHashMap<>();
    private List<Map<String, Object>> notifications = new ArrayList<>();
    private List<String> acknowledged = new ArrayList<>();

    /** @param file optional JSON file for persistence across restarts; null keeps state in memory only. */
    @SuppressWarnings("unchecked")
    public Simulation(Path file) {
        this.file = file;
        if (file != null && Files.exists(file)) {
            try {
                var state = (Map<String, Object>) Json.parse(Files.readString(file));
                flights = new LinkedHashMap<>((Map<String, Object>) state.get("flights"));
                notifications = new ArrayList<>((List<Map<String, Object>>) state.get("notifications"));
                acknowledged = new ArrayList<>((List<String>) state.get("acknowledged"));
            } catch (Exception e) { System.err.println("Ignoring unreadable simulation file: " + e.getMessage()); }
        }
    }

    public static List<Map<String, Object>> demoPassengers(String aircraftId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String[] names = {"Alex Morgan", "Sam Taylor", "Jordan Lee"};
        for (int i = 0; i < names.length; i++) list.add(Map.of("id", "demo-" + aircraftId + "-" + (i + 1), "name", names[i]));
        return list;
    }

    public static String message(String name, String label, boolean cancelled) {
        String first = name.split(" ")[0];
        return cancelled
            ? "Hi " + first + ", flight " + label + " has been cancelled in this simulation. We are checking later departures and estimated fares. If no route is found, a demo voucher may apply after 8 hours from scheduled departure: $25 USD, increasing to $50 after 12 hours. Suggested flights are not confirmed bookings and demo vouchers are not redeemable. This is a demo notification, not an airline cancellation."
            : "Hi " + first + ", the simulated cancellation of flight " + label + " has been withdrawn. Your demo booking is restored. The actual airline flight was never changed.";
    }

    /** Returns false when nothing changed (ineligible flight or same state). */
    @SuppressWarnings("unchecked")
    public synchronized boolean update(Map<String, Object> aircraft, boolean cancelled, Instant now) {
        String id = String.valueOf(aircraft.get("id"));
        var existing = (Map<String, Object>) flights.get(id);
        if (cancelled && !LiveFlights.eligible(aircraft, now)) return false;
        if (existing == null && !cancelled) return false;
        if (existing != null && Objects.equals(existing.get("cancelled"), cancelled)) return false;
        var passengers = existing != null ? (List<Map<String, Object>>) existing.get("passengers") : demoPassengers(id);
        String callsign = String.valueOf(aircraft.getOrDefault("callsign", ""));
        String label = callsign.isBlank() ? id.toUpperCase(Locale.ROOT) : callsign;
        long at = now.toEpochMilli();
        List<Map<String, Object>> fresh = new ArrayList<>();
        for (var p : passengers) {
            Map<String, Object> n = new LinkedHashMap<>();
            n.put("id", id + "-" + at + "-" + cancelled + "-" + p.get("id"));
            n.put("aircraft", aircraft); n.put("passenger", p); n.put("cancelled", cancelled); n.put("at", at);
            n.put("message", message(String.valueOf(p.get("name")), label, cancelled));
            fresh.add(n);
        }
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("aircraft", aircraft); entry.put("cancelled", cancelled); entry.put("at", at); entry.put("passengers", passengers);
        flights.put(id, entry);
        fresh.addAll(notifications);
        notifications = new ArrayList<>(fresh.subList(0, Math.min(MAX_NOTIFICATIONS, fresh.size())));
        save();
        return true;
    }

    @SuppressWarnings("unchecked")
    public synchronized Map<String, Object> flight(String id) {
        var entry = (Map<String, Object>) flights.get(id);
        return entry == null ? null : (Map<String, Object>) entry.get("aircraft");
    }

    @SuppressWarnings("unchecked")
    public synchronized Set<String> cancelledIds() {
        Set<String> ids = new HashSet<>();
        flights.forEach((id, e) -> { if (Boolean.TRUE.equals(((Map<String, Object>) e).get("cancelled"))) ids.add(id); });
        return ids;
    }

    public synchronized void acknowledge(String id) {
        if (!acknowledged.contains(id)) { acknowledged.add(id); save(); }
    }

    /** Clears the passenger inbox only; simulated cancellations stay active. */
    public synchronized void clearNotifications() {
        notifications = new ArrayList<>(); acknowledged = new ArrayList<>(); save();
    }

    public synchronized Map<String, Object> state() {
        return Map.of("flights", new LinkedHashMap<>(flights), "notifications", new ArrayList<>(notifications), "acknowledged", new ArrayList<>(acknowledged));
    }

    /** Recommendations and voucher decision for a simulated cancellation, evaluated against the given clock. */
    public Map<String, Object> support(Map<String, Object> aircraft, List<Map<String, Object>> liveCandidates, Instant now) {
        List<Map<String, Object>> candidates = new ArrayList<>(liveCandidates);
        candidates.addAll(ScheduleRecommendations.simulatedOnward(LiveFlights.hubCode(String.valueOf(aircraft.get("destination"))), now));
        var routes = ScheduleRecommendations.itineraries(aircraft, candidates, cancelledIds(), now);
        return Map.of("flight", aircraft, "itineraries", routes, "voucher", SupportPolicy.voucher(aircraft, routes.size(), now));
    }

    private void save() {
        if (file == null) return;
        try { Files.writeString(file, Json.stringify(state())); }
        catch (Exception e) { System.err.println("Could not save simulation: " + e.getMessage()); }
    }
}
