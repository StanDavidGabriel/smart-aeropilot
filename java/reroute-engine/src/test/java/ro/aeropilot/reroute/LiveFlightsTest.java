package ro.aeropilot.reroute;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Run with java -ea; no test framework required. */
public final class LiveFlightsTest {
    public static void main(String[] args) {
        Instant now = Instant.parse("2026-10-31T12:10:00Z");
        Map<String, Object> flight = new HashMap<>(Map.of("origin", "OTP", "destination", "LHR", "officialStatus", "Expected", "scheduledDeparture", "2026-10-31T13:10:00Z"));
        assert LiveFlights.eligible(flight, now);
        flight.put("destination", "JFK"); assert !LiveFlights.eligible(flight, now);
        flight.put("destination", "LHR");
        for (String status : new String[]{"Departed", "EnRoute", "Airborne", "Arrived", "Canceled", "Unknown"}) {
            flight.put("officialStatus", status); assert !LiveFlights.eligible(flight, now) : status;
        }
        flight.put("officialStatus", "Expected");
        flight.put("scheduledDeparture", "2026-11-01T12:10:00Z"); assert LiveFlights.eligible(flight, now);
        flight.put("scheduledDeparture", "2026-11-01T12:10:01Z"); assert !LiveFlights.eligible(flight, now);
        flight.put("scheduledDeparture", now.toString()); assert !LiveFlights.eligible(flight, now);
        flight.put("scheduledDeparture", "2026-10-31T13:10:00Z");
        flight.put("actualDeparture", "2026-10-31T12:00:00Z"); assert !LiveFlights.eligible(flight, now);
        System.out.println("Java departure rules passed");
    }
}