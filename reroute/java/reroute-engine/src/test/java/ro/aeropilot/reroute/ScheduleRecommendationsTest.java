package ro.aeropilot.reroute;
import java.time.Instant;
import java.util.*;
public final class ScheduleRecommendationsTest {
    public static void main(String[] args) {
        var original = new HashMap<String, Object>(Map.of("id", "LO644", "origin", "OTP", "destination", "WAW", "officialStatus", "Expected", "scheduledDeparture", "2026-11-01T03:35:00Z"));
        var later = new HashMap<String, Object>(original);
        later.put("id", "LO642"); later.put("scheduledDeparture", "2026-11-01T06:20:00Z");
        var now = Instant.parse("2026-10-31T12:22:00Z");
        assert ScheduleRecommendations.recommend(original, List.of(original, later), Set.of("LO644"), now).equals(List.of(later));
        assert ScheduleRecommendations.recommend(original, List.of(later), Set.of("LO642"), now).isEmpty();
        later.put("officialStatus", "Departed");
        assert ScheduleRecommendations.recommend(original, List.of(later), Set.of(), now).isEmpty();
        var first = new HashMap<String, Object>(original);
        first.put("id", "OTP-FRA"); first.put("destination", "FRA"); first.put("scheduledDeparture", "2026-11-01T04:00:00Z"); first.put("scheduledArrival", "2026-11-01T06:00:00Z");
        var second = new HashMap<String, Object>(original);
        second.put("id", "FRA-WAW"); second.put("origin", "FRA"); second.put("scheduledDeparture", "2026-11-01T06:45:00Z");
        assert ScheduleRecommendations.itineraries(original, List.of(first), Set.of(), now).isEmpty();
        assert ScheduleRecommendations.itineraries(original, List.of(first, second), Set.of(), now).get(0).get("legs").equals(List.of(first, second));
        second.put("scheduledDeparture", "2026-11-01T06:44:00Z");
        assert ScheduleRecommendations.itineraries(original, List.of(first, second), Set.of(), now).isEmpty();
        var simulated = ScheduleRecommendations.simulatedOnward("WAW", now);
        assert simulated.size() == 72;
        assert simulated.stream().allMatch(a -> "simulated".equals(a.get("scheduleSource")) && !"OTP".equals(a.get("origin")));
        var candidates = new ArrayList<Map<String, Object>>(simulated);
        candidates.add(first);
        var routes = ScheduleRecommendations.itineraries(original, candidates, Set.of(), now);
        assert !routes.isEmpty();
        assert SupportPolicy.estimate(List.of(original)).equals(Map.of("low", 106L, "high", 185L, "currency", "USD"));
        var departure = Instant.parse(String.valueOf(original.get("scheduledDeparture")));
        assert SupportPolicy.voucher(original, 0, departure.plusSeconds(8 * 3600).minusMillis(1)).get("amount").equals(0);
        assert SupportPolicy.voucher(original, 0, departure.plusSeconds(8 * 3600)).get("amount").equals(25);
        assert SupportPolicy.voucher(original, 0, departure.plusSeconds(12 * 3600)).get("amount").equals(50);
        assert SupportPolicy.voucher(original, 1, departure.plusSeconds(24 * 3600)).get("amount").equals(0);
        System.out.println("Java scheduled recommendation tests passed");
    }
}