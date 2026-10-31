import { describe, expect, it } from 'vitest';
import { LIVE_REFRESH_MS, aeroDataBoxPath, normalizeAeroDataBox, simulationStatus, normalizeCoverage, worldwideAirportPath, selectDueAirports, canSimulateCancellation, europeanAirportPaths } from './live';
const response = { departures: [{ number: 'RO 703', status: 'Expected', departure: { scheduledTime: { utc: '2026-10-31 10:35Z' } }, arrival: { airport: { iata: 'IAS' } }, airline: { name: 'TAROM' } }], arrivals: [] };
describe('AeroDataBox flights and independent cancellation simulations', () => {
  it('discovers all returned worldwide airports without restricting to Bucharest', () => {
    expect(normalizeCoverage({ items: ['KJFK', 'RJTT', 'LROP', 'KJFK'] })).toEqual(['KJFK', 'LROP', 'RJTT']);
    expect(() => normalizeCoverage({ items: ['../bad'] })).toThrow();
  });
  it('requests passenger departures in two twelve-hour windows covering 24 hours', () => {
    expect(europeanAirportPaths('EGLL')).toEqual([0, 720].map(offset => `/flights/airports/icao/EGLL?offsetMinutes=${offset}&durationMinutes=720&direction=Departure&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLeg=true`));
    expect(worldwideAirportPath('EGLL')).toContain('direction=Departure');
  });
  it('normalizes airports outside Romania and preserves identity across airport feeds', () => {
    const row = { number: 'JL 6', departure: { airport: { iata: 'HND' }, scheduledTime: { utc: '2026-10-31 03:00Z' } }, arrival: { airport: { iata: 'JFK' }, scheduledTime: { utc: '2026-10-31 16:00Z' } } };
    const departure = normalizeAeroDataBox({ departures: [row, row], arrivals: [] }, new Date(), 'RJTT');
    expect(departure.aircraft).toHaveLength(1);
    expect(departure.aircraft[0]?.origin).toBe('HND');
    expect(departure.aircraft[0]?.destination).toBe('JFK');
    const arrival = normalizeAeroDataBox({ departures: [], arrivals: [row] }, new Date(), 'KJFK');
    expect(arrival.aircraft[0]?.id).toBe(departure.aircraft[0]?.id);
  });
  it('resumes oldest due airports while respecting ten-minute cycles and active leases', () => {
    expect(selectDueAirports([
      { code: 'KJFK', attemptedAt: null, leaseUntil: null },
      { code: 'RJTT', attemptedAt: 0, leaseUntil: null },
      { code: 'LROP', attemptedAt: 1, leaseUntil: null },
      { code: 'EGLL', attemptedAt: null, leaseUntil: 900000 },
    ], 600000, 2)).toEqual(['KJFK', 'RJTT']);
  });
  it('refreshes every ten minutes', () => expect(LIVE_REFRESH_MS).toBe(600000));
  it('allows simulated cancellation without changing official status', () => {
    const snapshot = normalizeAeroDataBox(response);
    const a = snapshot.aircraft[0];
    expect(a?.officialStatus).toBe('Expected');
    expect(a?.id).toBe('adb:RO703:OTP:IAS:2026-10-31T10:35:00.000Z');
    expect(simulationStatus(a?.id ?? '', new Set([a?.id ?? '']))).toBe('cancelled');
  });
  it('keeps flight identity stable across status updates but separates different dates', () => {
    const first = normalizeAeroDataBox(response).aircraft[0];
    const changed = normalizeAeroDataBox({ ...response, departures: [{ ...response.departures[0], status: 'Departed' }] }).aircraft[0];
    const nextDay = normalizeAeroDataBox({ ...response, departures: [{ ...response.departures[0], departure: { scheduledTime: { utc: '2026-11-01 10:35Z' } } }] }).aircraft[0];
    expect(changed?.id).toBe(first?.id);
    expect(nextDay?.id).not.toBe(first?.id);
  });
  it('uses Bucharest local time for a twelve-hour departure-only window', () => {
    expect(aeroDataBoxPath(new Date('2026-10-31T11:40:00Z'))).toBe('/flights/airports/iata/OTP/2026-10-31T13:40/2026-11-01T01:40?direction=Departure&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLeg=true');
  });
  it('normalizes arrivals and rejects invalid provider responses', () => {
    const result = normalizeAeroDataBox({ departures: [], arrivals: [{ number: 'LH 1418', status: 'Arrived', departure: { airport: { iata: 'FRA' } }, arrival: { scheduledTime: { utc: '2026-10-31 12:00Z' } } }] });
    expect(result.aircraft[0]?.origin).toBe('FRA');
    expect(result.aircraft[0]?.destination).toBe('OTP');
    expect(() => normalizeAeroDataBox({ error: 'quota exceeded' })).toThrow();
  });
});
describe('upcoming major European departures', () => {
  const now = Date.parse('2026-10-31T12:10:00Z');
  const flight = { ...normalizeAeroDataBox(response).aircraft[0], id: 'test', callsign: 'RO1', country: '', latitude: null, longitude: null, altitude: null, speed: null, onGround: false, origin: 'OTP', destination: 'LHR', officialStatus: 'Expected', scheduledDeparture: '2026-10-31T13:10:00Z' };
  it('allows only routes between major European hubs', () => {
    expect(canSimulateCancellation(flight, now)).toBe(true);
    expect(canSimulateCancellation({ ...flight, destination: 'JFK' }, now)).toBe(false);
    expect(canSimulateCancellation({ ...flight, origin: 'JFK' }, now)).toBe(false);
    expect(canSimulateCancellation({ ...flight, destination: 'IAS' }, now)).toBe(false);
  });
  it('accepts future departures up to exactly 24 hours, never past or missing times', () => {
    for (const [time, expected] of [['2026-10-31T12:10:00Z', false], ['2026-10-31T12:09:00Z', false], ['2026-11-01T12:10:00Z', true], ['2026-11-01T12:10:01Z', false], ['', false]] as const) {
      expect(canSimulateCancellation({ ...flight, scheduledDeparture: time }, now)).toBe(expected);
    }
  });
  it('rejects airborne, departed, arrived, cancelled and unknown flights even with future schedules', () => {
    for (const officialStatus of ['Departed', 'EnRoute', 'Airborne', 'Arrived', 'Landed', 'Canceled', 'Cancelled', 'Unknown']) {
      expect(canSimulateCancellation({ ...flight, officialStatus }, now)).toBe(false);
    }
    expect(canSimulateCancellation({ ...flight, actualDeparture: '2026-10-31T12:00:00Z' }, now)).toBe(false);
  });
});