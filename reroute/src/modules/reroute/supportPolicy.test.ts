import { describe, expect, it } from 'vitest';
import { airportDistanceKm, estimateFare, voucherDecision } from './supportPolicy';
import type { LiveAircraft } from './live';
const flight: LiveAircraft = { id: 'policy', callsign: 'TEST', origin: 'OTP', destination: 'WAW', scheduledDeparture: '2026-11-01T00:00:00Z', country: '', latitude: null, longitude: null, altitude: null, speed: null, onGround: true };
const at = (hours: number) => Date.parse(flight.scheduledDeparture ?? '') + hours * 3600000;
describe('conditional demo vouchers', () => {
  it('treats absent flight details as unknown without granting a voucher', () => {
    // Reproduce a runtime caller missing its flight prop during a preview update.
    const absentFlight = JSON.parse('null');
    expect(voucherDecision(absentFlight, 0, at(24))).toEqual({ status: 'unknown', amount: 0 });
    expect(voucherDecision(undefined, 0, at(24))).toEqual({ status: 'unknown', amount: 0 });
  });
  it('does not grant a voucher before eight hours including future departures', () => {
    expect(voucherDecision(flight, 0, at(8) - 1).amount).toBe(0);
    expect(voucherDecision(flight, 0, at(-10)).amount).toBe(0);
  });
  it('grants USD 25 at exactly eight hours without a route', () => { expect(voucherDecision(flight, 0, at(8)).amount).toBe(25); });
  it('grants USD 50 at twelve hours without a route', () => {
    expect(voucherDecision(flight, 0, at(12) - 1).amount).toBe(25);
    expect(voucherDecision(flight, 0, at(12)).amount).toBe(50);
  });
  it('never grants a fallback voucher when a route exists', () => { expect(voucherDecision(flight, 1, at(24)).amount).toBe(0); });
  it('does not infer eligibility from missing departure times', () => { const { scheduledDeparture, ...missing } = flight; expect(voucherDecision(missing, 0, at(24)).amount).toBe(0); });
});
describe('distance-based demo fares', () => {
  it('estimates per-person USD fares for OTP–WAW', () => {
    expect(airportDistanceKm('LROP', 'EPWA')).toBeCloseTo(924.67, 1);
    expect(estimateFare({ legs: [flight] })).toEqual({ low: 106, high: 185, currency: 'USD' });
  });
  it('adds every connecting leg to the estimate', () => {
    expect(estimateFare({ legs: [{ ...flight, destination: 'FRA' }, { ...flight, origin: 'FRA' }] })).toEqual({ low: 252, high: 440, currency: 'USD' });
  });
  it('leaves fares unknown for unsupported airports or empty routes', () => {
    expect(estimateFare({ legs: [{ ...flight, destination: 'UNKNOWN' }] })).toBeUndefined();
    expect(estimateFare({ legs: [] })).toBeUndefined();
  });
});
