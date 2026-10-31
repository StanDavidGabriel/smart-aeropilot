import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { refreshOtpFlights } from '@/modules/reroute/refresh.server';

export const Route = createFileRoute('/api/public/reroute/refresh')({
  server: { handlers: { POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    try {
      const body = await request.json().catch(() => ({})) as { coverageOnly?: boolean };
      if (body.coverageOnly === true) return Response.json({ airports: ['LROP'], discoveryOnly: true });
      const key = process.env['UDC_AERODATABOX_API_KEY'];
      const appKey = process.env['LOVABLE_API_KEY'];
      if (!key || !appKey) throw new Error('AeroDataBox connection unavailable');
      return Response.json(await refreshOtpFlights(key, appKey));
    } catch (error) {
      console.error('Live flight refresh failed', error);
      return Response.json({ error: error instanceof Error ? error.message : 'Refresh failed; previous observations retained.' }, { status: 502 });
    }
  } } },
});