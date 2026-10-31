import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: () => ({ upsert: mocks.upsert }) } }));
import { refreshOtpFlights } from './refresh.server';
describe('OTP provider refresh', () => {
  beforeEach(() => { vi.restoreAllMocks(); mocks.upsert.mockReset(); mocks.upsert.mockResolvedValue({ error: null }); });
  it('fetches exactly two OTP windows and saves only eligible OTP departures', async () => {
    const departure = new Date(Date.now() + 3600000).toISOString();
    const flight = { number: 'RO 1', status: 'Expected', departure: { airport: { iata: 'OTP' }, scheduledTime: { utc: departure } }, arrival: { airport: { iata: 'WAW' } } };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ departures: [flight, { ...flight, number: 'OTHER', departure: { ...flight.departure, airport: { iata: 'FRA' } } }] })));
    const result = await refreshOtpFlights('test-connection', 'test-app');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(call => String(call[0]))).toEqual([0, 720].map(offset => `https://connector-gateway.lovable.dev/udc_aerodatabox/flights/airports/icao/LROP?offsetMinutes=${offset}&durationMinutes=720&direction=Departure&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLeg=true`));
    expect(result.count).toBe(1);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ scope: 'romania', observed_at: result.observedAt, aircraft: [expect.objectContaining({ origin: 'OTP', destination: 'WAW' })] }));
  });
  it('retains the previous snapshot if either provider window fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{"departures":[]}')).mockResolvedValueOnce(new Response('Quota exceeded', { status: 429 }));
    await expect(refreshOtpFlights('test-connection', 'test-app')).rejects.toThrow('429');
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
