// send-sms — Supabase Edge Function. Paste into Dashboard → Edge Functions → Deploy new function, name: send-sms
// Secrets (Edge Functions → Secrets): AT_USERNAME, AT_API_KEY, AT_ENV (sandbox|live), AT_SENDER_ID (optional)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Any Kenyan format → +2547XXXXXXXX / +2541XXXXXXXX
function normalize(raw: string): string | null {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('2540')) d = '254' + d.slice(4);
  if (d.startsWith('0') && d.length === 10) d = '254' + d.slice(1);
  if (d.length === 9 && /^[17]/.test(d)) d = '254' + d;
  return /^254[17]\d{8}$/.test(d) ? '+' + d : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await admin.auth.getUser(token);
  if (!who?.user) return json({ error: 'Not signed in' }, 401);

  const username = Deno.env.get('AT_USERNAME') || 'sandbox';
  const apiKey = Deno.env.get('AT_API_KEY');
  const env = Deno.env.get('AT_ENV') === 'live' ? 'live' : 'sandbox';
  const from = Deno.env.get('AT_SENDER_ID') || '';
  if (!apiKey) return json({ error: 'AT_API_KEY secret is not set in Supabase' }, 500);
  const host = env === 'live' ? 'https://api.africastalking.com' : 'https://api.sandbox.africastalking.com';

  const { messages = [] } = await req.json().catch(() => ({}));
  const results = [];
  for (const m of (messages as { id: string; to: string; body: string }[]).slice(0, 100)) {
    const to = normalize(m.to);
    if (!m.id || !to || !m.body) { results.push({ id: m.id, status: 'failed', error: 'Bad phone number or empty message' }); continue; }

    const { error: claimErr } = await admin.from('sms_claims').insert({ id: m.id, to_phone: to });
    if (claimErr) {
      const { data: prev } = await admin.from('sms_claims').select('*').eq('id', m.id).maybeSingle();
      results.push({ id: m.id, status: prev?.status === 'sending' ? 'sent' : (prev?.status || 'sent'),
        gatewayId: prev?.gateway_id || '', cost: prev?.cost ?? null, error: prev?.error || '', duplicate: true });
      continue;
    }

    let status = 'failed', gatewayId = '', cost: number | null = null, error = '';
    try {
      const form = new URLSearchParams({ username, to, message: m.body });
      if (from) form.set('from', from);
      const r = await fetch(host + '/version1/messaging', {
        method: 'POST',
        headers: { apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });
      const j = await r.json().catch(() => null);
      const rec = j?.SMSMessageData?.Recipients?.[0];
      if (rec && [100, 101, 102].includes(Number(rec.statusCode))) {
        status = 'sent'; gatewayId = rec.messageId || '';
        cost = parseFloat(String(rec.cost || '').replace(/[^\d.]/g, '')) || 0;
      } else {
        error = rec?.status || j?.SMSMessageData?.Message || `Africa's Talking HTTP ${r.status}`;
      }
    } catch (e) { error = String((e as Error).message || e); }

    if (status === 'failed') await admin.from('sms_claims').delete().eq('id', m.id); // allow a retry
    else await admin.from('sms_claims').update({ status, gateway_id: gatewayId, cost, error }).eq('id', m.id);
    results.push({ id: m.id, status, gatewayId, cost, error });
  }
  return json({ env, results });
});
