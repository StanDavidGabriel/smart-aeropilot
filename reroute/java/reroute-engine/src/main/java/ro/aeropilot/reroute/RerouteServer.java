package ro.aeropilot.reroute;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * HTTP API (JDK only, no dependencies).
 *   GET  /api/reroute/health
 *   GET  /api/reroute/network            -> raw network.json
 *   POST /api/reroute/cancel {"flightId"} -> re-routing results for every affected passenger
 * Usage: java -jar reroute-engine.jar [path/to/network.json] [port]
 */
public final class RerouteServer {
    public static void main(String[] args) throws IOException {
        Path data = Path.of(args.length > 0 ? args[0] : "../../src/data/network.json");
        int port = args.length > 1 ? Integer.parseInt(args[1]) : 8081;
        String raw = Files.readString(data);
        RerouteEngine engine = new RerouteEngine(Model.load(raw));
        LiveFlights liveFlights = new LiveFlights();
        liveFlights.start();

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/reroute/health", ex -> send(ex, 200, "{\"ok\":true,\"engine\":\"java\"}"));
        server.createContext("/api/reroute/network", ex -> send(ex, 200, raw));
        server.createContext("/api/reroute/live-flights", ex -> {
            try {
                var query = new java.util.HashMap<String, String>();
                for (String part : String.valueOf(ex.getRequestURI().getRawQuery()).split("&")) {
                    String[] pair = part.split("=", 2);
                    if (pair.length == 2) query.put(pair[0], java.net.URLDecoder.decode(pair[1], StandardCharsets.UTF_8));
                }
                int page = Integer.parseInt(query.getOrDefault("page", "0"));
                if (page < 0 || page > 100000) throw new IllegalArgumentException("Invalid page");
                String snapshot = liveFlights.snapshot(query.getOrDefault("search", ""), query.getOrDefault("airport", ""), page);
                send(ex, snapshot == null ? 503 : 200, snapshot == null ? "{\"error\":\"Waiting for AeroDataBox; configure server environment credentials\"}" : snapshot);
            } catch (IllegalArgumentException error) { send(ex, 400, "{\"error\":\"Invalid flight query\"}"); }
        });
        server.createContext("/api/reroute/recommendations", ex -> {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 204, ""); return; }
            if (!ex.getRequestMethod().equals("POST")) { send(ex, 405, "{}"); return; }
            try {
                byte[] body = ex.getRequestBody().readNBytes(1000001);
                if (body.length > 1000000) { send(ex, 413, "{}"); return; }
                @SuppressWarnings("unchecked")
                Map<String, Object> req = (Map<String, Object>) Json.parse(new String(body, StandardCharsets.UTF_8));
                @SuppressWarnings("unchecked")
                Map<String, Object> flight = (Map<String, Object>) req.get("flight");
                @SuppressWarnings("unchecked")
                java.util.List<Map<String, Object>> candidates = (java.util.List<Map<String, Object>>) req.get("candidates");
                @SuppressWarnings("unchecked")
                java.util.List<String> excluded = (java.util.List<String>) req.get("excluded");
                send(ex, 200, Json.stringify(ScheduleRecommendations.itineraries(flight, candidates, new java.util.HashSet<>(excluded), java.time.Instant.now())));
            } catch (Exception e) { send(ex, 400, "{\"error\":\"Invalid recommendation input\"}"); }
        });
        server.createContext("/api/reroute/support", ex -> {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 204, ""); return; }
            if (!ex.getRequestMethod().equals("POST")) { send(ex, 405, "{}"); return; }
            try {
                byte[] body = ex.getRequestBody().readNBytes(1000001);
                if (body.length > 1000000) { send(ex, 413, "{}"); return; }
                @SuppressWarnings("unchecked")
                Map<String, Object> req = (Map<String, Object>) Json.parse(new String(body, StandardCharsets.UTF_8));
                @SuppressWarnings("unchecked")
                Map<String, Object> flight = (Map<String, Object>) req.get("flight");
                @SuppressWarnings("unchecked")
                java.util.List<Map<String, Object>> candidates = (java.util.List<Map<String, Object>>) req.get("candidates");
                @SuppressWarnings("unchecked")
                java.util.List<String> excluded = (java.util.List<String>) req.get("excluded");
                var now = java.time.Instant.now();
                var routes = ScheduleRecommendations.itineraries(flight, candidates, new java.util.HashSet<>(excluded), now);
                send(ex, 200, Json.stringify(Map.of("itineraries", routes, "voucher", SupportPolicy.voucher(flight, routes.size(), now))));
            } catch (Exception e) { send(ex, 400, "{\"error\":\"Invalid support input\"}"); }
        });
        server.createContext("/api/reroute/cancel", ex -> {
            if (ex.getRequestMethod().equals("OPTIONS")) { send(ex, 204, ""); return; }
            try {
                String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                @SuppressWarnings("unchecked")
                Map<String, Object> req = (Map<String, Object>) Json.parse(body);
                send(ex, 200, Json.stringify(engine.cancel((String) req.get("flightId"))));
            } catch (Exception e) {
                send(ex, 400, Json.stringify(Map.of("error", String.valueOf(e.getMessage()))));
            }
        });
        server.start();
        System.out.println("Reroute engine on http://localhost:" + port + " using " + data.toAbsolutePath());
    }

    private static void send(HttpExchange ex, int status, String body) throws IOException {
        byte[] b = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        ex.sendResponseHeaders(status, status == 204 ? -1 : b.length);
        if (status != 204) try (OutputStream os = ex.getResponseBody()) { os.write(b); }
        ex.close();
    }
}
