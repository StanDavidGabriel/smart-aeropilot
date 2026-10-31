package ro.aeropilot.reroute;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/** AeroDataBox schedules and status only; never passenger manifests or bookable inventory. */
public final class LiveFlights {
    public static final long REFRESH_MINUTES = 10;
    private static final Map<String, String> HUBS = Map.ofEntries(
        Map.entry("EGLL","LHR"), Map.entry("EGKK","LGW"), Map.entry("LFPG","CDG"), Map.entry("LFPO","ORY"),
        Map.entry("EDDF","FRA"), Map.entry("EDDM","MUC"), Map.entry("EDDB","BER"), Map.entry("EHAM","AMS"),
        Map.entry("LEMD","MAD"), Map.entry("LEBL","BCN"), Map.entry("LIRF","FCO"), Map.entry("LIMC","MXP"),
        Map.entry("LTFM","IST"), Map.entry("EIDW","DUB"), Map.entry("LSZH","ZRH"), Map.entry("LSGG","GVA"),
        Map.entry("LOWW","VIE"), Map.entry("EBBR","BRU"), Map.entry("EKCH","CPH"), Map.entry("ENGM","OSL"),
        Map.entry("ESSA","ARN"), Map.entry("EFHK","HEL"), Map.entry("LPPT","LIS"), Map.entry("LGAV","ATH"),
        Map.entry("EPWA","WAW"), Map.entry("LKPR","PRG"), Map.entry("LHBP","BUD"), Map.entry("LROP","OTP"));
    public static String hubCode(String code) { return HUBS.getOrDefault(code, code); }
    public static boolean eligible(Map<String, Object> a, Instant now) {
        String origin = String.valueOf(a.get("origin")), destination = String.valueOf(a.get("destination"));
        if (!(HUBS.containsKey(origin) || HUBS.containsValue(origin)) || !(HUBS.containsKey(destination) || HUBS.containsValue(destination))) return false;
        String status = String.valueOf(a.getOrDefault("officialStatus", "Unknown")).toLowerCase(java.util.Locale.ROOT).replaceAll("[\\s_-]", "");
        if (!List.of("expected","scheduled","checkin","boarding","gateclosed","delayed").contains(status) || a.get("actualDeparture") != null) return false;
        try {
            Instant departure = Instant.parse(String.valueOf(a.get("scheduledDeparture")));
            return departure.isAfter(now) && !departure.isAfter(now.plusSeconds(86400));
        } catch (RuntimeException e) { return false; }
    }
    private volatile String snapshot;
    private final Map<String, String> snapshots = new LinkedHashMap<>();
    private final Map<String, Long> attempts = new LinkedHashMap<>();
    private List<String> airports = List.of("LROP");
    private int cursor;
    private boolean worldwide() { return false; } // Legacy flags cannot activate multi-airport calls.

    public void start() {
        var scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "aerodatabox-refresh"); t.setDaemon(true); return t;
        });
        long interval = 600;
        if (interval < 1) throw new IllegalArgumentException("Refresh interval must be positive");
        scheduler.scheduleWithFixedDelay(this::refresh, 0, interval, TimeUnit.SECONDS);
    }

    public String snapshot() { return snapshot("", "", 0); }
    public String snapshot(String search, String airport, int page) {
        String current = snapshot;
        if (current == null) return null;
        Map<String, Object> result = new LinkedHashMap<>(object(Json.parse(current)));
        List<Object> rows = new ArrayList<>();
        for (Object raw : (List<?>) result.get("aircraft")) {
            Map<String, Object> a = object(raw);
            if (!eligible(a, Instant.now()) || !"OTP".equals(hubCode(String.valueOf(a.get("origin"))))) continue;
            String text = String.valueOf(a.get("callsign")) + " " + a.get("origin") + " " + a.get("destination") + " " + a.get("airline");
            if (text.toLowerCase().contains(search.toLowerCase()) && (airport.isEmpty() || airport.equals(a.get("origin")) || HUBS.getOrDefault(airport, airport).equals(a.get("origin")))) rows.add(raw);
        }
        rows.sort(java.util.Comparator.comparing(raw -> String.valueOf(object(raw).get("id"))));
        int start = Math.min(rows.size(), Math.max(0, page) * 50);
        result.put("totalFlights", rows.size()); result.put("pageSize", 50); result.put("page", page);
        result.put("aircraft", rows.subList(start, Math.min(rows.size(), start + 50)));
        return Json.stringify(result);
    }

    private String request(String path) throws Exception {
        String connectorKey = System.getenv("UDC_AERODATABOX_API_KEY"), appKey = System.getenv("LOVABLE_API_KEY"), rapidKey = System.getenv("RAPIDAPI_KEY");
        boolean gateway = connectorKey != null && appKey != null;
        if (!gateway && (rapidKey == null || rapidKey.isBlank())) throw new IllegalStateException("Configure private provider credentials");
        var builder = HttpRequest.newBuilder(URI.create((gateway ? "https://connector-gateway.lovable.dev/udc_aerodatabox" : "https://aerodatabox.p.rapidapi.com") + path))
            .timeout(Duration.ofSeconds(20)).header("X-RapidAPI-Host", "aerodatabox.p.rapidapi.com");
        if (gateway) builder.header("Authorization", "Bearer " + appKey).header("X-Connection-Api-Key", connectorKey);
        else builder.header("X-RapidAPI-Key", rapidKey);
        var response = HttpClient.newHttpClient().send(builder.GET().build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 204) return "{\"departures\":[],\"arrivals\":[]}";
        if (response.statusCode() != 200) throw new IllegalStateException("AeroDataBox HTTP " + response.statusCode());
        return response.body();
    }

    @SuppressWarnings("unchecked")
    private void refresh() {
        try {
            Instant now = Instant.now();
            String airport = "LROP";
            if (worldwide() && now.toEpochMilli() - attempts.getOrDefault(airport, 0L) < 600000) return;
            attempts.put(airport, now.toEpochMilli());
            List<Object> departures = new ArrayList<>();
            for (int offset : List.of(0, 720)) {
                String path = "/flights/airports/icao/" + airport + "?offsetMinutes=" + offset + "&durationMinutes=720&direction=Departure&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLeg=true";
                Map<String, Object> part = object(Json.parse(request(path)));
                if (!(part.get("departures") instanceof List<?> rows)) throw new IllegalArgumentException("Invalid AeroDataBox departures");
                departures.addAll(rows);
            }
            Map<String, Object> body = Map.of("departures", departures);
            Map<String, Object> flights = new LinkedHashMap<>();
            for (String direction : List.of("departures")) {
              if (!(body.get(direction) instanceof List<?> rows)) throw new IllegalArgumentException("Invalid AeroDataBox flight records");
              for (Object raw : rows) {
                if (!(raw instanceof Map<?, ?>)) continue;
                Map<String, Object> row = (Map<String, Object>) raw;
                if (!(row.get("number") instanceof String number)) continue;
                Map<String, Object> departure = object(row.get("departure")), arrival = object(row.get("arrival"));
                String origin = object(departure.get("airport")).isEmpty() ? HUBS.getOrDefault(airport, airport) : airport(departure);
                String destination = direction.equals("arrivals") && object(arrival.get("airport")).isEmpty() ? (worldwide() ? airport : "OTP") : airport(arrival);
                String departureTime = time(departure), arrivalTime = time(arrival);
                 String identityTime = departureTime != null ? departureTime : arrivalTime;
                if (identityTime == null) continue;
                String callsign = number.replaceAll("\\s", "");
                String id = "adb:" + callsign + ":" + origin + ":" + destination + ":" + identityTime;
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("id", id); a.put("callsign", callsign); a.put("country", "");
                a.put("longitude", null); a.put("latitude", null); a.put("altitude", null); a.put("speed", null); a.put("onGround", false);
                a.put("origin", origin); a.put("destination", destination);
                a.put("scheduledDeparture", departureTime); a.put("scheduledArrival", arrivalTime);
                String actual = time(Map.of("scheduledTime", object(departure.get("actualTime"))));
                if (actual == null) actual = time(Map.of("scheduledTime", object(departure.get("runwayTime"))));
                if (actual != null) a.put("actualDeparture", actual);
                a.put("officialStatus", row.getOrDefault("status", "Unknown"));
                a.put("airline", object(row.get("airline")).getOrDefault("name", ""));
                if (eligible(a, now)) flights.put(id, a);
              }
            }
            snapshots.put(airport, Json.stringify(Map.of("aircraft", new ArrayList<>(flights.values()), "observedAt", now.toString(), "fetchedAt", Instant.now().toString())));
            Map<String, Object> combined = new LinkedHashMap<>();
            String oldest = now.toString();
            for (String stored : snapshots.values()) {
                Map<String, Object> part = object(Json.parse(stored));
                if (String.valueOf(part.get("observedAt")).compareTo(oldest) < 0) oldest = String.valueOf(part.get("observedAt"));
                for (Object item : (List<?>) part.get("aircraft")) {
                    var flight = object(item);
                    combined.put(String.valueOf(flight.get("id")), flight);
                }
            }
            snapshot = Json.stringify(Map.of("aircraft", new ArrayList<>(combined.values()), "observedAt", oldest, "fetchedAt", now.toString(),
                "coverage", Map.of("supported", 1, "loaded", snapshots.size(), "failed", Math.max(0, attempts.size() - snapshots.size()), "stale", snapshots.values().stream().filter(stored -> Instant.parse(String.valueOf(object(Json.parse(stored)).get("observedAt"))).isBefore(now.minusSeconds(1200))).count(), "airports", List.of("LROP"), "enabled", true)));
        } catch (Exception e) {
            System.err.println("AeroDataBox refresh failed; keeping previous snapshot: " + e.getMessage());
        }
    }
    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(Object value) { return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of(); }
    private static String airport(Map<String, Object> movement) {
        var a = object(movement.get("airport"));
        return String.valueOf(a.getOrDefault("iata", a.getOrDefault("icao", "Unknown")));
    }
    private static String time(Map<String, Object> movement) {
        Object value = object(movement.get("scheduledTime")).get("utc");
        if (!(value instanceof String text)) return null;
        String iso = text.replace(' ', 'T');
        if (iso.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}Z")) iso = iso.substring(0, 16) + ":00Z";
        try { return DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneId.of("UTC")).format(Instant.parse(iso)); }
        catch (RuntimeException e) { return null; }
    }
}