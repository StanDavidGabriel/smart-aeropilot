// Calls the Java engine; falls back to the in-browser TypeScript mirror.
import network from "@/data/network.json";
import { cancelFlight } from "./router";
import type { CancelResponse, Network } from "./types";

export const NETWORK = network as unknown as Network;
export const JAVA_URL = (import.meta.env["VITE_REROUTE_API_URL"] as string | undefined) ?? "http://localhost:8081";

export async function requestReroute(flightId: string): Promise<CancelResponse> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`${JAVA_URL}/api/reroute/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flightId }), signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.ok) return (await r.json()) as CancelResponse;
  } catch {
    /* Java engine offline → browser fallback */
  }
  return cancelFlight(NETWORK, flightId);
}
