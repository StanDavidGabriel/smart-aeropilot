package ro.aeropilot.reroute;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/** Passenger SMS for sample-network reroutes: AI-written when LOVABLE_API_KEY is set, otherwise a fixed template. */
public final class PassengerMessages {
    private static final String SYSTEM = "You are an airline assistant. Write a warm, clear SMS in English only (at most 3 sentences), regardless of the passenger's name or country. No markdown or excessive emoji. Only state the itinerary and voucher provided; never invent details.";

    @SuppressWarnings("unchecked")
    public static String fallback(Map<String, Object> cancelled, Map<String, Object> result) {
        var passenger = (Map<String, Object>) result.get("passenger");
        String first = String.valueOf(passenger.get("name")).split(" ")[0];
        var voucher = (Map<String, Object>) result.get("voucher");
        Object total = voucher == null ? 0 : voucher.get("total");
        var chosen = (Map<String, Object>) result.get("chosen");
        if (chosen == null) return "Hi " + first + ", flight " + cancelled.get("id") + " to " + cancelled.get("to") + " was cancelled and no alternative itinerary has been found yet. Your demo voucher is " + total + " EUR. Your booking is awaiting assistance.";
        StringJoiner route = new StringJoiner(", ");
        for (var l : (List<Map<String, Object>>) chosen.get("legs"))
            route.add(l.get("id") + " (" + l.get("from") + " " + l.get("depart") + " → " + l.get("to") + " " + l.get("arrive") + ")");
        boolean hasVoucher = total instanceof Number n && n.doubleValue() > 0;
        return "Hi " + first + ", flight " + cancelled.get("id") + " was cancelled and your demo booking has been moved to: " + route + ". You arrive at " + chosen.get("arrive") + "." + (hasVoucher ? " Your demo voucher is " + total + " EUR." : "");
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> generate(Map<String, Object> cancelled, Map<String, Object> result) {
        String key = System.getenv("LOVABLE_API_KEY");
        if (key == null || key.isBlank()) return Map.of("message", fallback(cancelled, result), "source", "template");
        try {
            var passenger = (Map<String, Object>) result.get("passenger");
            var chosen = (Map<String, Object>) result.get("chosen");
            var voucher = (Map<String, Object>) result.get("voucher");
            String route = "no itinerary found";
            if (chosen != null) {
                StringJoiner j = new StringJoiner(", ");
                for (var l : (List<Map<String, Object>>) chosen.get("legs")) j.add(l.get("id") + " " + l.get("from") + "→" + l.get("to"));
                route = j.toString();
            }
            String prompt = "Passenger: " + passenger.get("name") + " (party of " + passenger.get("family_size") + "). Flight " + cancelled.get("id") + " was cancelled.\n"
                + "New itinerary: " + route + ". Arrival: " + (chosen == null ? "-" : chosen.get("arrive")) + ". Delay: " + Objects.requireNonNullElse(result.get("delay_minutes"), "-") + " minutes.\n"
                + "Compensation voucher: " + (voucher == null ? 0 : voucher.get("total")) + " EUR.";
            String body = Json.stringify(Map.of("model", "google/gemini-3-flash-preview", "messages", List.of(
                Map.of("role", "system", "content", SYSTEM), Map.of("role", "user", "content", prompt))));
            var request = HttpRequest.newBuilder(URI.create("https://ai.gateway.lovable.dev/v1/chat/completions"))
                .timeout(Duration.ofSeconds(20)).header("Authorization", "Bearer " + key).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("AI HTTP " + response.statusCode() + ": " + response.body());
            var parsed = (Map<String, Object>) Json.parse(response.body());
            var choice = (Map<String, Object>) ((List<Object>) parsed.get("choices")).get(0);
            String text = String.valueOf(((Map<String, Object>) choice.get("message")).get("content")).trim();
            if (text.isEmpty()) throw new IllegalStateException("Empty AI response");
            return Map.of("message", text, "source", "ai");
        } catch (Exception e) {
            System.err.println("AI message failed, using template: " + e.getMessage());
            return Map.of("message", fallback(cancelled, result), "source", "template");
        }
    }
}
