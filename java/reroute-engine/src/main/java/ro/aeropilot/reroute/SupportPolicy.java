package ro.aeropilot.reroute;
import java.time.Instant;
import java.util.*;
/** TS mirror: supportPolicy.ts. Demo fares and non-redeemable goodwill vouchers. */
public final class SupportPolicy {
    private static final Map<String, double[]> POINTS = Map.ofEntries(
        Map.entry("LHR", new double[]{51.47, -0.4543}),
        Map.entry("LGW", new double[]{51.1537, -0.1821}),
        Map.entry("CDG", new double[]{49.0097, 2.5479}),
        Map.entry("ORY", new double[]{48.7262, 2.3652}),
        Map.entry("FRA", new double[]{50.0379, 8.5622}),
        Map.entry("MUC", new double[]{48.3538, 11.7861}),
        Map.entry("BER", new double[]{52.3667, 13.5033}),
        Map.entry("AMS", new double[]{52.3105, 4.7683}),
        Map.entry("MAD", new double[]{40.4983, -3.5676}),
        Map.entry("BCN", new double[]{41.2974, 2.0833}),
        Map.entry("FCO", new double[]{41.8003, 12.2389}),
        Map.entry("MXP", new double[]{45.6306, 8.7281}),
        Map.entry("IST", new double[]{41.2753, 28.7519}),
        Map.entry("DUB", new double[]{53.4213, -6.2701}),
        Map.entry("ZRH", new double[]{47.4581, 8.5555}),
        Map.entry("GVA", new double[]{46.2381, 6.1089}),
        Map.entry("VIE", new double[]{48.1103, 16.5697}),
        Map.entry("BRU", new double[]{50.9014, 4.4844}),
        Map.entry("CPH", new double[]{55.6181, 12.6561}),
        Map.entry("OSL", new double[]{60.1939, 11.1004}),
        Map.entry("ARN", new double[]{59.6519, 17.9186}),
        Map.entry("HEL", new double[]{60.3172, 24.9633}),
        Map.entry("LIS", new double[]{38.7742, -9.1342}),
        Map.entry("ATH", new double[]{37.9364, 23.9445}),
        Map.entry("WAW", new double[]{52.1657, 20.9671}),
        Map.entry("PRG", new double[]{50.1008, 14.26}),
        Map.entry("BUD", new double[]{47.4298, 19.2611}),
        Map.entry("OTP", new double[]{44.5711, 26.085}));
    public static Map<String, Object> estimate(List<Map<String, Object>> legs) {
        if (legs.isEmpty()) return Map.of();
        double base = 0;
        for (var leg : legs) {
            var a = POINTS.get(LiveFlights.hubCode(String.valueOf(leg.get("origin"))));
            var b = POINTS.get(LiveFlights.hubCode(String.valueOf(leg.get("destination"))));
            if (a == null || b == null) return Map.of();
            double h = Math.pow(Math.sin(Math.toRadians(b[0]-a[0])/2), 2) + Math.cos(Math.toRadians(a[0])) * Math.cos(Math.toRadians(b[0])) * Math.pow(Math.sin(Math.toRadians(b[1]-a[1])/2), 2);
            double km = 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
            base += 40 + km * 0.10;
        }
        return Map.of("low", Math.round(base * 0.8), "high", Math.round(base * 1.4), "currency", "USD");
    }
    public static Map<String, Object> voucher(Map<String, Object> flight, int alternativeCount, Instant now) {
        Instant departure;
        try { departure = Instant.parse(String.valueOf(flight.get("scheduledDeparture"))); }
        catch (RuntimeException e) { return Map.of("status", "unknown", "amount", 0); }
        if (alternativeCount > 0) return Map.of("status", "route-found", "amount", 0);
        long elapsed = now.toEpochMilli() - departure.toEpochMilli();
        if (elapsed < 8 * 3600000L) return Map.of("status", "waiting", "amount", 0, "eligibleAt", departure.toEpochMilli() + 8 * 3600000L);
        return Map.of("status", "eligible", "amount", elapsed >= 12 * 3600000L ? 50 : 25);
    }
}
