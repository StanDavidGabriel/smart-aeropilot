import { canSimulateCancellation, type LiveAircraft } from './live';

export interface SimulationPassenger { id: string; name: string }
export interface FlightSimulation {
  aircraft: LiveAircraft;
  cancelled: boolean;
  at: number;
  passengers: SimulationPassenger[];
}
export interface PassengerNotification {
  id: string;
  aircraft: LiveAircraft;
  passenger: SimulationPassenger;
  cancelled: boolean;
  at: number;
  message: string;
}
export interface SimulationState {
  flights: Record<string, FlightSimulation>;
  notifications: PassengerNotification[];
  acknowledged: string[];
}
const KEY = 'aeropilot-live-simulation-v1';
const CHANNEL = 'aeropilot-live-simulation';
export const emptySimulation = (): SimulationState => ({ flights: {}, notifications: [], acknowledged: [] });

/** Synthetic recipients only: AeroDataBox does not supply passenger manifests. */
export function demoPassengers(aircraftId: string): SimulationPassenger[] {
  return ['Alex Morgan', 'Sam Taylor', 'Jordan Lee'].map((name, i) => ({ id: `demo-${aircraftId}-${i + 1}`, name }));
}

export function updateFlightSimulation(state: SimulationState, aircraft: LiveAircraft, cancelled: boolean, at = Date.now()): SimulationState {
  if (cancelled && !canSimulateCancellation(aircraft, at)) return state;
  if (state.flights[aircraft.id]?.cancelled === cancelled) return state;
  const passengers = state.flights[aircraft.id]?.passengers ?? demoPassengers(aircraft.id);
  const label = aircraft.callsign || aircraft.id.toUpperCase();
  const notifications = passengers.map(passenger => ({
    id: `${aircraft.id}-${at}-${cancelled}-${passenger.id}`, aircraft, passenger, cancelled, at,
    message: cancelled
      ? `Hi ${passenger.name.split(' ')[0]}, flight ${label} has been cancelled in this simulation. We are checking later departures and estimated fares. If no route is found, a demo voucher may apply after 8 hours from scheduled departure: $25 USD, increasing to $50 after 12 hours. Suggested flights are not confirmed bookings and demo vouchers are not redeemable. This is a demo notification, not an airline cancellation.`
      : `Hi ${passenger.name.split(' ')[0]}, the simulated cancellation of flight ${label} has been withdrawn. Your demo booking is restored. The actual airline flight was never changed.`,
  }));
  return { ...state, flights: { ...state.flights, [aircraft.id]: { aircraft, cancelled, at, passengers } },
    notifications: [...notifications, ...state.notifications].slice(0, 150) };
}

export function readSimulation(): SimulationState {
  if (typeof window === 'undefined') return emptySimulation();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptySimulation();
    const state = JSON.parse(raw) as SimulationState;
    return state.flights && Array.isArray(state.notifications) && Array.isArray(state.acknowledged) ? state : emptySimulation();
  } catch { return emptySimulation(); }
}

const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;
function connect() {
  if (typeof window === 'undefined') return;
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => listeners.forEach(listener => listener());
  }
}
function writeSimulation(state: SimulationState) {
  window.localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach(listener => listener());
  connect();
  channel?.postMessage('updated');
}
export function simulateFlight(aircraft: LiveAircraft, cancelled: boolean) {
  writeSimulation(updateFlightSimulation(readSimulation(), aircraft, cancelled));
}
export function acknowledgeNotification(id: string) {
  const state = readSimulation();
  if (!state.acknowledged.includes(id)) writeSimulation({ ...state, acknowledged: [...state.acknowledged, id] });
}
/** Clears the passenger inbox only; simulated cancellations and their alternatives stay active. */
export function clearNotifications() {
  const state = readSimulation();
  writeSimulation({ ...state, notifications: [], acknowledged: [] });
}
export function subscribeSimulation(listener: () => void) {
  connect();
  listeners.add(listener);
  const storage = (event: StorageEvent) => { if (event.key === KEY) listener(); };
  window.addEventListener('storage', storage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', storage); };
}