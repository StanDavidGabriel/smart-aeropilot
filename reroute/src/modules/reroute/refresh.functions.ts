import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const refreshLiveFlights = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env['UDC_AERODATABOX_API_KEY'];
    const appKey = process.env['LOVABLE_API_KEY'];
    if (!key || !appKey) throw new Error('AeroDataBox connection unavailable');
    const { refreshOtpFlights } = await import('./refresh.server');
    return refreshOtpFlights(key, appKey);
  });
