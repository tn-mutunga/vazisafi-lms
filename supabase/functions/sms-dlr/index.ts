// sms-dlr — Supabase Edge Function. Africa's Talking calls this when a text is delivered or fails.
// Deploy with "Verify JWT" OFF. Secret: DLR_KEY (any long random word).
// Callback URL to paste in Africa's Talking → SMS → Delivery Reports:
//   https://<project>.supabase.co/functions/v1/sms-dlr?k=<DLR_KEY>
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (!Deno.env.get('DLR_KEY') || url.searchParams.get('k') !== Deno.env.get('DLR_KEY')) return new Response('no', { status: 403 });
  const text = await req.text();
  const p = new URLSearchParams(text);
  let id = p.get('id'), st = p.get('status'), reason = p.get('failureReason') || '';
  if (!id) { try { const j = JSON.parse(text); id = j.id; st = j.status; reason = j.failureReason || ''; } catch { /* ignore */ } }
  if (!id) return new Response('ok');
  const status = st === 'Success' ? 'delivered' : (st === 'Failed' || st === 'Rejected') ? 'failed' : null;
  if (!status) return new Response('ok');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: claim } = await admin.from('sms_claims').update({ status, error: reason }).eq('gateway_id', id).select('id').maybeSingle();
  if (claim?.id) await admin.from('messages').update({ status, error: reason }).eq('id', claim.id);
  return new Response('ok');
});
