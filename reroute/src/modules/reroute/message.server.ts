import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function generateMessage(d: {
  name: string; cancelledFlight: string; route: string; arrive: string | null;
  delayMinutes: number | null; voucherTotal: number; familySize: number;
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system:
      "You are an airline assistant. Write a warm, clear SMS in English only (at most 3 sentences), regardless of the passenger’s name or country. No markdown or excessive emoji. Only state the itinerary and voucher provided; never invent details.",
    prompt: `Passenger: ${d.name} (party of ${d.familySize}). Flight ${d.cancelledFlight} was cancelled.
New itinerary: ${d.route || "no itinerary found"}. Arrival: ${d.arrive ?? "-"}. Delay: ${d.delayMinutes ?? "-"} minutes.
Compensation voucher: ${d.voucherTotal} EUR.`,
    providerOptions: {
      openai: { store: false, forceReasoning: true, reasoningEffort: "low" },
    },
  });
  const text = (await result.text).trim();
  if (!text) throw new Error("Empty AI response");
  return text;
}
