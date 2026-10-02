// Sends queued SMS through the send-sms edge function. Messages wait in the local
// queue while offline or signed out, and go out as soon as both are fine again.
window.SAFI_SMS = (() => {
  let busy = false, last = null;
  const subs = new Set();
  const emit = () => subs.forEach(f => { try { f(last); } catch {} });

  async function run() {
    const C = window.SAFI_CLOUD, S = window.SAFI_STORE;
    if (busy || !C || !S || !S.queuedMessages) return;
    if (!(S.getSettings() || {}).smsLive) return;
    if (!C.status().signedIn || !navigator.onLine) return;
    const q = S.queuedMessages();
    if (!q.length) return;
    busy = true;
    try {
      for (let i = 0; i < q.length; i += 50) {
        const batch = q.slice(i, i + 50);
        const out = await C.raw('/functions/v1/send-sms', {
          method: 'POST',
          body: JSON.stringify({ messages: batch.map(m => ({ id: m.id, to: m.to, body: m.body })) }),
        });
        S.updateMessages((out.results || []).map(r => ({
          id: r.id, status: r.status, gatewayId: r.gatewayId || '', cost: r.cost ?? null, error: r.error || '',
        })));
        last = { ok: true, at: Date.now(), env: out.env };
      }
    } catch (e) {
      last = { ok: false, at: Date.now(), error: e.message || String(e) };
    } finally { busy = false; emit(); }
  }

  async function test(to) {
    const C = window.SAFI_CLOUD;
    if (!C || !C.status().signedIn) throw new Error('Sign in on Cloud & Updates first');
    const out = await C.raw('/functions/v1/send-sms', {
      method: 'POST', body: JSON.stringify({ messages: [{ id: 'test-' + Date.now(), to, body: 'Vazi Safi: test message. SMS is working.' }] }),
    });
    const r = (out.results || [])[0] || {};
    if (r.status !== 'sent') throw new Error(r.error || 'Not sent');
    return { env: out.env, cost: r.cost };
  }

  setInterval(run, 20000);
  window.addEventListener('online', () => setTimeout(run, 2000));
  setTimeout(run, 5000);
  return { run, kick: () => setTimeout(run, 400), test, last: () => last, subscribe: f => { subs.add(f); return () => subs.delete(f); } };
})();
