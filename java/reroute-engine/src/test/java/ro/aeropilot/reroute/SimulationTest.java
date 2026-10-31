package ro.aeropilot.reroute;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Run with java -ea; no test framework required. */
public final class SimulationTest {
    @SuppressWarnings("unchecked")
    public static void main(String[] args) {
        Instant now = Instant.parse("2026-10-31T12:10:00Z");
        Map<String, Object> flight = new HashMap<>(Map.of("id", "adb:RO391:OTP:LHR:2026-10-31T14:00:00.000Z", "callsign", "RO391",
            "origin", "OTP", "destination", "LHR", "officialStatus", "Expected", "scheduledDeparture", "2026-10-31T14:00:00.000Z"));
        Simulation sim = new Simulation(null);

        assert sim.update(flight, true, now);
        assert sim.cancelledIds().contains(flight.get("id"));
        var state = sim.state();
        assert ((List<?>) state.get("notifications")).size() == 3 : "three synthetic passengers notified";
        assert !sim.update(flight, true, now) : "repeat cancel is a no-op";

        assert sim.update(flight, false, now.plusSeconds(60));
        assert sim.cancelledIds().isEmpty();
        assert ((List<?>) sim.state().get("notifications")).size() == 6;

        Map<String, Object> departed = new HashMap<>(flight);
        departed.put("id", "other"); departed.put("officialStatus", "Departed");
        assert !sim.update(departed, true, now) : "departed flights cannot be cancelled";

        String firstId = String.valueOf(((Map<String, Object>) ((List<?>) sim.state().get("notifications")).get(0)).get("id"));
        sim.acknowledge(firstId);
        assert ((List<?>) sim.state().get("acknowledged")).contains(firstId);
        sim.update(flight, true, now);
        sim.clearNotifications();
        assert ((List<?>) sim.state().get("notifications")).isEmpty();
        assert sim.cancelledIds().contains(flight.get("id")) : "clearing inbox keeps cancellations";

        // No alternatives within 8h of scheduled departure -> waiting; at 12h -> USD 50.
        var support = sim.support(flight, List.of(), now);
        assert "route-found".equals(((Map<String, Object>) support.get("voucher")).get("status")) || "waiting".equals(((Map<String, Object>) support.get("voucher")).get("status"));
        assert (int) SupportPolicy.voucher(flight, 0, Instant.parse("2026-10-31T22:00:00Z")).get("amount") == 25;
        assert (int) SupportPolicy.voucher(flight, 0, Instant.parse("2026-11-01T02:00:00Z")).get("amount") == 50;
        System.out.println("Java simulation rules passed");
    }
}
