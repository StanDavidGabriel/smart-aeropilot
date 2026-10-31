// Shared wire types — identical shape to the Java engine's JSON output.
export interface Airport { code: string; name: string; city: string; lat: number; lon: number }
export interface Flight {
  id: string; from: string; to: string; depart: string; arrive: string;
  seats_available: number; airline: string;
}
export interface Passenger {
  id: string; name: string; flight: string;
  tight_connection: boolean; family_size: number; deadline: string | null;
}
export interface Network {
  airports: Airport[]; flights: Flight[]; passengers: Passenger[];
  defaults: { min_connection_minutes: number; connection_penalty_minutes: number; max_stops: number };
}
export interface Itinerary { legs: Flight[]; depart: string; arrive: string; stops: number; cost: number }
export interface Voucher { compensation: number; meal: number; total: number; code: string }
export interface RerouteResult {
  passenger: Passenger; priority: number; options: Itinerary[]; chosen: Itinerary | null;
  delay_minutes: number | null; voucher: Voucher; status: "rebooked" | "unrouted";
}
export interface CancelResponse { cancelled: Flight; engine: "java" | "browser"; results: RerouteResult[] }

/** Events on the shared AeroPilot bus. */
export interface CancelEvent { type: "CancelEvent"; flightId: string; reason?: string; at: number }
export interface RerouteEvent {
  type: "RerouteEvent"; at: number; cancelled: Flight; result: RerouteResult; message: string;
}
