import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeAeroDataBox } from './live';
import { acknowledgeNotification, clearNotifications, emptySimulation, readSimulation, simulateFlight, updateFlightSimulation } from './simulation';

const aircraft = { id: 'abc123', callsign: 'ROT123', country: 'Romania', latitude: null, longitude: null, altitude: null, speed: null, onGround: true, origin: 'OTP', destination: 'LHR', officialStatus: 'Expected', scheduledDeparture: new Date(Date.now() + 3600000).toISOString() };
describe('observed-flight passenger interaction', () => {
  beforeEach(() => localStorage.clear());
  it('notifies only the demo passengers assigned to the cancelled observed flight', () => {
    const state = updateFlightSimulation(emptySimulation(), aircraft, true);
    expect(state.notifications).toHaveLength(3);
    expect(state.notifications.every(n => n.aircraft.id === 'abc123' && n.passenger.id.startsWith('demo-abc123-') && n.cancelled)).toBe(true);
    expect(aircraft.onGround).toBe(true);
  });
  it('does not duplicate notifications for an already-cancelled flight', () => {
    const state = updateFlightSimulation(emptySimulation(), aircraft, true);
    expect(updateFlightSimulation(state, aircraft, true).notifications).toHaveLength(3);
  });
  it('restores the same bookings and notifies the same recipients', () => {
    const cancelled = updateFlightSimulation(emptySimulation(), aircraft, true);
    const restored = updateFlightSimulation(cancelled, aircraft, false, 101);
    expect(restored.flights['abc123']?.cancelled).toBe(false);
    expect(restored.notifications.slice(0, 3).map(n => n.passenger.id)).toEqual(cancelled.notifications.map(n => n.passenger.id));
    expect(restored.notifications.slice(0, 3).every(n => !n.cancelled)).toBe(true);
  });
  it('retains cancellation and notifications after provider refresh and navigation', () => {
    simulateFlight(aircraft, true);
    normalizeAeroDataBox({ departures: [], arrivals: [] });
    expect(readSimulation().flights['abc123']?.cancelled).toBe(true);
    expect(readSimulation().notifications).toHaveLength(3);
  });
  it('stores a passenger acknowledgement for Ops to read', () => {
    simulateFlight(aircraft, true);
    const notification = readSimulation().notifications[0];
    if (!notification) throw new Error('Missing notification');
    acknowledgeNotification(notification.id);
    expect(readSimulation().acknowledged).toEqual([notification.id]);
  });
  it('clears the inbox and acknowledgements but keeps simulated cancellations', () => {
    simulateFlight(aircraft, true);
    clearNotifications();
    const state = readSimulation();
    expect(state.notifications).toHaveLength(0);
    expect(state.acknowledged).toHaveLength(0);
    expect(state.flights['abc123']?.cancelled).toBe(true);
  });
  it('does not create cancellations or passenger notifications for flights already departed', () => {
    const state = emptySimulation();
    expect(updateFlightSimulation(state, { ...aircraft, officialStatus: 'Departed' }, true)).toBe(state);
    expect(updateFlightSimulation(state, { ...aircraft, scheduledDeparture: '2026-01-01T00:00:00Z' }, true)).toBe(state);
  });
});