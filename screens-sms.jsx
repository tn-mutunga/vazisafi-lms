// ─── SMS gateway + bulk campaigns (owner) ─────────────────────────────────
const { useState: useStateSMS, useEffect: useEffectSMS } = React;
const SMS_RATE = 0.8; // KES per 160-char part, approximate

function smsParts(text) {
  const n = (text || '').length;
  if (!n) return 0;
  return n <= 160 ? 1 : Math.ceil(n / 153);
}

function SmsStatus({ m }) {
  const map = { logged: ['gray', 'logged'], queued: ['amber', 'waiting'], sending: ['amber', 'sending'], sent: ['blue', 'sent'],
    delivered: ['green', 'delivered'], failed: ['red', 'failed'] };
  const [c, label] = map[m.status] || ['gray', m.status || '—'];
  return <span className={`safi-pill safi-pill--${c}`} title={m.error || (m.cost != null ? `KES ${m.cost}` : '')}>{label}</span>;
}

function SmsGatewayCard() {
  const D = useStore();
  const on = !!(D.settings || {}).smsLive;
  const [last, setLast] = useStateSMS(window.SAFI_SMS ? window.SAFI_SMS.last() : null);
  const [to, setTo] = useStateSMS('');
  const [busy, setBusy] = useStateSMS(false);
  useEffectSMS(() => window.SAFI_SMS ? window.SAFI_SMS.subscribe(setLast) : undefined, []);
  const queued = D.messages.filter(m => m.status === 'queued').length;
  const month = SAFI_TIME.day().slice(0, 7);
  const spent = D.messages.filter(m => (m.date || '').startsWith(month) && m.cost).reduce((s, m) => s + Number(m.cost || 0), 0);

  async function test() {
    setBusy(true);
    try { const r = await window.SAFI_SMS.test(to); toast(`Test sent (${r.env}${r.cost ? `, KES ${r.cost}` : ''})`, 'success'); }
    catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  }

  return (
    <Card title="SMS gateway · Africa's Talking" action={
      <label className="safi-check"><input type="checkbox" checked={on} onChange={e => window.SAFI_STORE.setSetting('smsLive', e.target.checked)}/> Send real SMS</label>
    }>
      <div className="safi-sms-gw">
        <div><span>Status</span><b>{!on ? 'Off · texts are only logged' : !last ? 'Waiting for first send' : last.ok ? `Working${last.env === 'sandbox' ? ' · SANDBOX (test only)' : ''}` : `Problem: ${last.error}`}</b></div>
        <div><span>Waiting to send</span><b>{queued}</b></div>
        <div><span>Spent this month</span><b className="safi-mono">KES {spent.toFixed(2)}</b></div>
      </div>
      <div className="safi-sms-test">
        <input className="safi-input safi-mono" placeholder="07XX XXX XXX" value={to} onChange={e => setTo(e.target.value)}/>
        <Button kind="ghost" disabled={busy || !to.trim()} onClick={test}>{busy ? 'Sending…' : 'Send test SMS'}</Button>
      </div>
      <p className="safi-cell-sub" style={{ margin: '8px 0 0' }}>Needs this laptop signed in on Cloud &amp; Updates. Keys live in Supabase, never on the laptop.</p>
    </Card>
  );
}

function SmsCampaignCard() {
  const D = useStore();
  const [aud, setAud] = useStateSMS('all');
  const [days, setDays] = useStateSMS(30);
  const [body, setBody] = useStateSMS('Hi {name}, ');

  const last = {};
  for (const o of D.orders) if (o.customer && (!last[o.customer] || o.in > last[o.customer])) last[o.customer] = o.in;
  const cutoff = SAFI_TIME.daysAgo(days);
  const seen = new Set();
  const list = D.customers.filter(c => {
    if (!c.phone) return false;
    if (['student', 'normal', 'corporate'].includes(aud) && c.group !== aud) return false;
    if (aud === 'inactive' && !(last[c.id] && last[c.id].slice(0, 10) <= cutoff)) return false;
    const k = String(c.phone).replace(/\D/g, '').slice(-9);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  const sample = list[0];
  const render = c => body.replace(/\{name\}/g, (c?.name || 'Faith').split(' ')[0]);
  const parts = smsParts(render(sample));
  const cost = Math.round(list.length * parts * SMS_RATE);

  function send() {
    if (!list.length || !body.trim()) return;
    window.safiPinConfirm({
      title: `Send to ${list.length} customer${list.length === 1 ? '' : 's'}?`,
      body: `About KES ${cost} (${parts} SMS part${parts === 1 ? '' : 's'} each). This cannot be recalled once sent.`,
      confirmLabel: 'Send',
      onConfirm: () => {
        const id = 'cmp' + Date.now().toString(36);
        for (const c of list) window.SAFI_STORE.logMessage({
          to: `${c.prefix || ''} ${c.phone}`.trim(), name: c.name, body: render(c),
          stage: 'campaign', method: 'sms', customerId: c.id, campaignId: id,
        });
        toast(`${list.length} texts queued`, 'success');
        setBody('Hi {name}, ');
      },
    });
  }

  return (
    <Card title="Bulk SMS campaign">
      <div className="safi-form">
        <div className="safi-toolbar__filters">
          {[['all', 'All customers'], ['student', 'Students'], ['normal', 'Normal'], ['corporate', 'Corporate'], ['inactive', 'Not seen in…']].map(([k, l]) => (
            <button key={k} className={`safi-chip ${aud === k ? 'is-active' : ''}`} onClick={() => setAud(k)}>{l}</button>
          ))}
          {aud === 'inactive' && <label className="safi-sms-days"><input type="number" className="safi-input safi-mono" value={days} min="1" onChange={e => setDays(Math.max(1, +e.target.value || 1))}/> days</label>}
        </div>
        <label>Message <span className="safi-cell-sub">· {'{name}'} becomes the first name</span>
          <textarea className="safi-input" rows="3" value={body} onChange={e => setBody(e.target.value)}/>
        </label>
        <div className="safi-sms-preview">
          <div className="safi-cell-sub">Preview{sample ? ` for ${sample.name}` : ''}</div>
          <div className="safi-msg-body">{render(sample)}</div>
        </div>
        <div className="safi-sms-foot">
          <span className="safi-cell-sub">{render(sample).length} characters · {parts} part{parts === 1 ? '' : 's'} · <b>{list.length}</b> recipients · about <b>KES {cost}</b></span>
          <Button kind="primary" disabled={!list.length || body.trim().length < 5} onClick={send}>Send campaign</Button>
        </div>
        {!(D.settings || {}).smsLive && <p className="safi-cell-sub" style={{ margin: 0 }}>Real sending is off, so these will only be logged.</p>}
      </div>
    </Card>
  );
}

Object.assign(window, { SmsStatus, SmsGatewayCard, SmsCampaignCard });
