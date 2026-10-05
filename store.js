
// Local-time date helpers. Never use toISOString() for shop dates: it is UTC, so
// anything done 00:00-03:00 in Nairobi lands on the previous day.
// Kenyan numbers are stored as 9 digits "729 480 592"; the +254 lives in prefix.
window.SAFI_PHONE = (prefix, phone) => {
  let d = String(phone || '').replace(/\D/g, '');
  const pd = String(prefix || '+254').replace(/\D/g, '');
  if (pd && d.startsWith(pd) && d.length > 9) d = d.slice(pd.length);
  d = d.replace(/^0+/, '');
  if (pd === '254') { d = d.slice(-9); return d.length > 6 ? d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6) : d.replace(/(\d{3})(?=\d)/g, '$1 '); }
  return d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
};
// Order numbers carry a 2-letter laptop code internally (SF-2446-EG) so two tills can
// never clash. People only ever see SF-2446.
window.orderNo = (id) => String(id || '').replace(/-[A-Z]{2}$/, '');
window.SAFI_TIME = (() => {
  const p = n => String(n).padStart(2, '0');
  const day = (d = new Date()) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const stamp = (d = new Date()) => `${day(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return day(d); };
  return { day, stamp, daysAgo };
})();
// Vazi Safi — persistent local store
// Backed by localStorage (works offline, persists across sessions on this browser/laptop).
// On first run, seeded from window.SAFI_DATA (sample data).
// Use `SAFI_STORE.<action>(…)` from anywhere; React hook `useStore()` re-renders on changes.

window.SAFI_STORE = (() => {
  const KEY = 'vazi-safi-state-v1';
  const SAMPLE = window.SAFI_DATA;

  // Deep clone helper
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  let state = load() || clone(SAMPLE);

  // Migration: make sure all expected top-level keys exist (in case of schema bumps)
  for (const k of ['services','customers','staff','orders','revenueTrend','revenueByService','revenueByMethod','payments','packages','discounts','inventory','issues','expenseCategories','expenses']) {
    if (!state[k]) state[k] = clone(SAMPLE[k]);
  }
  // New collections introduced after launch
  if (!state.messages)       state.messages = [];
  if (!state.dispatch)       state.dispatch = [];
  // Pickups/deliveries from before v2.0.1 have no date. Use the linked order's due
  // date, else the day it was scheduled.
  state.dispatch = state.dispatch.map(d => {
    if (d.slotDate) return d;
    const o = d.orderId && (state.orders || []).find(x => x.id === d.orderId);
    const guess = String((d.type === 'delivery' && o && o.due) || d.created || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(guess) ? { ...d, slotDate: guess, slotDateGuessed: true } : d;
  });
  if (!state.approvals)      state.approvals = [];
  if (!state.settings)       state.settings = { firstTimeBagFree: false, freeBagServiceId: 'laundry-bag' };
  // Integrity controls (added to close the unreceipted-order gap)
  if (!state.auditLog)       state.auditLog = [];
  if (!state.shifts)         state.shifts = [];
  if (!state.releases)       state.releases = [];
  if (!state.deliveryCards)  state.deliveryCards = [];
  if (state.settings.payTo === undefined)      state.settings.payTo = '';
  if (state.settings.payToName === undefined)  state.settings.payToName = '';
  if (state.settings.ownerPhone === undefined) state.settings.ownerPhone = '';
  // Tag numbers are optional (owner's call, v0.1.4). Turned off once for existing
  // installs; the owner can switch it back on in Settings and it will stay on.
  if (!state.settings.tagOptionalV014) { state.settings.requireTag = false; state.settings.tagOptionalV014 = true; }
  if (state.settings.requireIntakeSms === undefined) state.settings.requireIntakeSms = true;
  if (state.settings.varianceLimit === undefined)    state.settings.varianceLimit = 100;
  if (!state.smsTemplates || !state.smsTemplates.intake) {
    state.smsTemplates = { ...(state.smsTemplates || {}),
      intake: 'Vazi Safi: order {id} received, {items} item(s), total {total}. Tag {tag}. Pay ONLY to {payto}. Queries {owner}.' };
  }
  if (!state.smsTemplates)   state.smsTemplates = {
    ready:     'Hi {name}, your order {id} is READY for collection at Vazi Safi. Balance: {balance}. Asante!',
    washing:   'Hi {name}, your order {id} is being washed. We will text you when ready.',
    ironing:   'Hi {name}, your order {id} is being ironed and will be ready soon.',
    collected: 'Hi {name}, your order {id} has been collected. Asante, karibu tena!',
    delivery:  'Hi {name}, our rider {rider} is on the way with your order {id}. Please be available.',
  };
  // Backfill category on services from older saves
  for (const s of state.services) {
    if (!s.category) {
      const fromSample = SAMPLE.services.find(x => x.id === s.id);
      s.category = fromSample?.category || 'other';
    }
  }
  // Repair duplicate customer ids from earlier bulk imports.
  {
    const seen = new Set(); let fixed = 0;
    state.customers = (state.customers || []).map(c => {
      if (!seen.has(c.id)) { seen.add(c.id); return c; }
      fixed++;
      const id = 'c-' + Date.now().toString(36) + fixed.toString(36) + Math.random().toString(36).slice(2, 6);
      seen.add(id); return { ...c, id };
    });
    if (fixed) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} console.info('[safi] repaired', fixed, 'duplicate customer ids'); }
  }
  // One-time: curtains are charged by weight.
  if (!state.settings) state.settings = {};
  if (!state.settings.curtainKgV1) {
    state.services = state.services.map(x => x.id === 'curtain' ? { ...x, unit: 'kg' } : x);
    state.settings = { ...state.settings, curtainKgV1: true };
  }
  // Backfill new services (hanger, laundry-bag) if missing from older saves
  for (const sampleSvc of SAMPLE.services) {
    if (!state.services.find(s => s.id === sampleSvc.id)) {
      state.services.push(clone(sampleSvc));
    }
  }
  // Backfill subtypes on existing services
  let migrated = false;
  for (const s of state.services) {
    const sample = SAMPLE.services.find(x => x.id === s.id);
    if (sample?.subtypes && !s.subtypes) { s.subtypes = clone(sample.subtypes); migrated = true; }
    // Convert old string-based subtypes to {name, price?} objects
    if (s.subtypes && s.subtypes.length && typeof s.subtypes[0] === 'string') {
      s.subtypes = s.subtypes.map(name => ({ name }));
      migrated = true;
    }
  }
  // Backfill customer phone prefix
  for (const c of state.customers) {
    if (!c.prefix) {
      // Detect prefix from existing phone if it begins with +
      const m = (c.phone || '').match(/^(\+\d{1,4})\s?(.*)$/);
      if (m) { c.prefix = m[1]; c.phone = m[2].trim(); }
      else c.prefix = '+254';
    }
  }

  // Daily client queue number. Authoritative one-time renumber: an earlier build wrote
  // these from array order rather than time, so fill-only would leave the bad values in
  // place forever. Recompute every order from the time-sorted list, once.
  if (!state.queueNoFixed) {
    const byDay = {};
    // state.orders is newest-first by id, not chronological, so sort on the timestamp
    const asc = [...state.orders].sort((a, b) => String(a.in || '').localeCompare(String(b.in || '')));
    for (const o of asc) {
      const day = String(o.in || '').slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      o.queueNo = byDay[day];
    }
    // Serials already printed from a wrong number are rewritten to match
    state.deliveryCards = (state.deliveryCards || []).map(c => {
      const o = state.orders.find(x => x.id === c.order);
      return o ? { ...c, queueNo: o.queueNo, serial: `${o.id}-${String(o.queueNo).padStart(2, '0')}` } : c;
    });
    state.queueNoFixed = true;
    migrated = true;
  }
  const listeners = new Set();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Safi: storage full', e); }
    listeners.forEach(fn => fn(state));
  }
  // One-time fix (v2.1.4): the shop PC's clock ran a day ahead on 2–3 Oct 2026.
  // SF-2416 (Alvin) and SF-2417 (Diana) were taken on 3 Oct; every earlier
  // order dated 3 or 4 Oct was really taken on 2 Oct.
  if (!state.fixOct2026Dates) {
    const num = (id) => parseInt(String(id).replace(/\D/g, ''), 10) || 0;
    const shift = (s, to) => to + String(s).slice(10);
    for (const o of state.orders || []) {
      const d = String(o.in || '').slice(0, 10);
      const n = num(o.id);
      let to = null;
      if (n >= 2416 && n <= 2417 && d === '2026-10-04') to = '2026-10-03';
      else if (n > 0 && n < 2416 && (d === '2026-10-03' || d === '2026-10-04')) to = '2026-10-02';
      if (!to) continue;
      o.in = shift(o.in, to);
      if (o.due && /^2026-10-0[34]/.test(o.due) && n < 2416) o.due = shift(o.due, '2026-10-03');
      for (const p of state.payments || []) if (p.order === o.id && /^2026-10-0[34]/.test(p.date || '')) p.date = shift(p.date, to);
    }
    state.fixOct2026Dates = true;
    migrated = true;
  }
  // v2.2.2: one phone format for every customer.
  for (const cu of state.customers || []) {
    const fixed = SAFI_PHONE(cu.prefix || '+254', cu.phone);
    if (cu.phone && fixed !== cu.phone) { cu.phone = fixed; migrated = true; }
    if (!cu.prefix) { cu.prefix = '+254'; migrated = true; }
  }
  // Persist any migration changes immediately
  if (migrated) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ID helpers
  // Order numbers must be unique across laptops. Each laptop numbers on its own, so two
  // tills could both make SF-2428 before syncing and one would overwrite the other in the
  // cloud. A short per-laptop code (e.g. SF-2428-K) keeps them apart.
  const DEVICE_KEY = 'safi_device_code_v1';
  const deviceCode = (() => {
    let c = localStorage.getItem(DEVICE_KEY);
    if (!c) { const L = 'ABCDEFGHJKMNPQRSTUVWXYZ'; c = L[Math.floor(Math.random() * L.length)] + L[Math.floor(Math.random() * L.length)]; localStorage.setItem(DEVICE_KEY, c); }
    return c;
  })();
  const nextOrderId = () => {
    const max = state.orders.reduce((m, o) => {
      const n = parseInt(String(o.id).replace(/^\D*(\d+).*$/, '$1'), 10) || 0;
      return n > m ? n : m;
    }, 2400);
    let id = `SF-${max + 1}-${deviceCode}`;
    while (state.orders.some(o => o.id === id)) id = `SF-${parseInt(id.slice(3), 10) + 1}-${deviceCode}`;
    return id;
  };
  // Counter + random so ids made in the same millisecond (bulk imports) never collide.
  let idSeq = 0;
  const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}${(idSeq++ % 1296).toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`;

  // Client number: position in today's queue. Resets each morning, so "client 7" means
  // the seventh customer served today — what staff and customers actually say out loud.
  const nextQueueNo = () => {
    const today = SAFI_TIME.day();
    return state.orders.filter(o => String(o.in || '').startsWith(today)).length + 1;
  };

  const STAGES = ['intake', 'washing', 'drying', 'ironing', 'ready', 'collected'];

  const stamp = (d) => SAFI_TIME.stamp(d || new Date());

  // Append-only trail. Every write that could hide money leaves a line here. Nothing in
  // the front-desk UI reads it, so it costs staff nothing to be honest and nothing to
  // forget it exists.
  function audit(action, target, detail, meta) {
    state.auditLog = [{
      id: nextId('au'), at: new Date().toISOString(),
      staff: state.currentStaffId || '', action,
      target: target || '', detail: detail || '', meta: meta || null,
    }, ...state.auditLog].slice(0, 5000);
  }

  return {
    audit(action, target, detail, meta) { audit(action, target, detail, meta); save(); },
    getAudit(filter) {
      let rows = state.auditLog || [];
      if (filter?.staff)  rows = rows.filter(r => r.staff === filter.staff);
      if (filter?.action) rows = rows.filter(r => r.action === filter.action);
      if (filter?.since)  rows = rows.filter(r => r.at >= filter.since);
      return rows;
    },

    // ── Shifts ──────────────────────────────────────────
    // Cash is only auditable if someone counted it at a known moment. A shift is that
    // moment: who was on the counter, from when, and what they declared at the end.
    getOpenShift() { return (state.shifts || []).find(s => !s.closedAt) || null; },
    openShift({ staffId, openingFloat }) {
      if (this.getOpenShift()) return null;
      const sh = {
        id: nextId('sh'), staff: staffId || state.currentStaffId || '',
        openedAt: new Date().toISOString(), openedAtLabel: stamp(),
        openingFloat: Math.round(openingFloat || 0),
        closedAt: '', declaredCash: 0, expectedCash: 0, variance: 0, note: '',
      };
      state.shifts = [sh, ...state.shifts];
      audit('shift.open', sh.id, `Float ${sh.openingFloat}`);
      save();
      return sh;
    },
    // Expected cash = float + cash taken in during the shift − cash expenses paid out.
    shiftExpected(sh) {
      if (!sh) return 0;
      const from = new Date(sh.openedAt).getTime() - 60e3, to = sh.closedAt ? new Date(sh.closedAt).getTime() + 60e3 : Date.now() + 60e3;
      // Payment/expense dates are shop-local "YYYY-MM-DD HH:MM"; parse as local, compare as instants.
      const inWin = (local) => { const t = new Date(String(local || '').replace(' ', 'T')).getTime(); return t >= from && t <= to; };
      const toIso = (d) => d;
      const cashIn = (state.payments || [])
        .filter(p => p.method === 'cash' && inWin(toIso(p.date)))
        .reduce((n, p) => n + (p.amount || 0), 0);
      const cashOut = (state.expenses || [])
        .filter(e => e.method === 'cash' && inWin(toIso(e.date)))
        .reduce((n, e) => n + (e.amount || 0), 0);
      return (sh.openingFloat || 0) + cashIn - cashOut;
    },
    closeShift({ declaredCash, note }) {
      const sh = this.getOpenShift();
      if (!sh) return null;
      const expected = this.shiftExpected(sh);
      const declared = Math.round(declaredCash || 0);
      const closed = {
        ...sh, closedAt: new Date().toISOString(), closedAtLabel: stamp(),
        declaredCash: declared, expectedCash: expected,
        variance: declared - expected, note: note || '',
      };
      state.shifts = state.shifts.map(s => s.id === sh.id ? closed : s);
      audit('shift.close', sh.id, `Declared ${declared}, expected ${expected}, variance ${closed.variance}`);
      save();
      return closed;
    },

    // ── Garment tags ──────────────────────────────────────
    // A physical numbered tag book is a controlled resource: every number printed must
    // end up against an order or be declared void. Skipped numbers are the audit.
    voidTag(tag, reason) {
      state.voidTags = [...(state.voidTags || []), {
        tag: String(tag), reason: reason || '', at: new Date().toISOString(),
        staff: state.currentStaffId || '',
      }];
      audit('tag.void', String(tag), reason || '');
      save();
    },

    // ── Rider delivery notes ─────────────────────────────────────────────
    // A controlled document. Every note carries a serial — the order number and the
    // client's queue number for that day — goes out with the rider, and has to come back
    // before that rider is paid.
    cardSerial(order) {
      const q = order.queueNo ? String(order.queueNo).padStart(2, '0') : '00';
      return `${order.id}-${q}`;
    },
    nextCardSerial() {
      const today = SAFI_TIME.day();
      const n = state.orders.filter(o => String(o.in || '').startsWith(today)).length + 1;
      return `${nextOrderId()}-${String(n).padStart(2, '0')}`;
    },
    issueDeliveryCard(orderId, dispatchId) {
      const order = state.orders.find(o => o.id === orderId);
      if (!order) return null;
      const existing = (state.deliveryCards || []).find(c => c.order === orderId);
      if (existing) return existing;
      const d = dispatchId
        ? (state.dispatch || []).find(x => x.id === dispatchId)
        : (state.dispatch || []).find(x => x.orderId === orderId && x.type === 'delivery');
      const due = Math.max(0, (order.total || 0) - (order.paid || 0));
      const card = {
        id: nextId('dc'), serial: this.cardSerial(order),
        dispatch: d?.id || '', order: orderId, customer: order.customer || '',
        rider: d?.rider || '', amountDue: due, tag: order.tag || '',
        queueNo: order.queueNo || null,
        issuedAt: new Date().toISOString(), issuedAtLabel: stamp(),
        issuedBy: state.currentStaffId || '',
        returnedAt: '', returnedBy: '', receivedAmount: 0,
        receivedMethod: '', receivedTxn: '', note: '',
      };
      state.deliveryCards = [card, ...(state.deliveryCards || [])];
      audit('card.issue', card.serial, `Order ${orderId}, due ${due}`, { rider: card.rider });
      save();
      return card;
    },
    getCardForOrder(orderId) {
      return (state.deliveryCards || []).find(c => c.order === orderId) || null;
    },
    returnDeliveryCard(id, { receivedAmount, receivedMethod, receivedTxn, note }) {
      const card = (state.deliveryCards || []).find(c => c.id === id);
      if (!card) return null;
      const next = {
        ...card,
        returnedAt: new Date().toISOString(), returnedAtLabel: stamp(),
        returnedBy: state.currentStaffId || '',
        receivedAmount: Math.round(receivedAmount || 0),
        receivedMethod: receivedMethod || '',
        receivedTxn: receivedTxn || '',
        note: note || '',
      };
      state.deliveryCards = state.deliveryCards.map(c => c.id === id ? next : c);
      audit('card.return', card.serial,
        `Received ${next.receivedAmount} of ${card.amountDue} due${next.receivedTxn ? ` (${next.receivedTxn})` : ''}`,
        { rider: card.rider, short: card.amountDue - next.receivedAmount });
      save();
      return next;
    },

    // ── Handover ───────────────────────────────────────────
    logRelease({ orderId, tag, releasedTo, balanceAtRelease }) {
      state.releases = [{
        id: nextId('rl'), at: new Date().toISOString(), atLabel: stamp(),
        order: orderId, tag: tag || '', releasedTo: releasedTo || '',
        staff: state.currentStaffId || '',
        balanceAtRelease: Math.round(balanceAtRelease || 0),
      }, ...state.releases];
      audit('order.release', orderId, `To ${releasedTo || 'customer'}${balanceAtRelease > 0 ? `, balance ${balanceAtRelease} outstanding` : ''}`);
      save();
    },

    get: () => state,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },

    // ── Messages / SMS log ─────────────────────────────────
    logPrint(kind, orderId) { audit('print.' + kind, orderId || '', kind + ' printed'); save(); },
    logMessage({ to, name, body, orderId, stage, method, customerId, campaignId }) {
      const now = new Date();
      const fmt = SAFI_TIME.stamp(now);
      const msg = {
        id: nextId('msg'), date: fmt, to, name, body,
        orderId: orderId || '', stage: stage || '', customerId: customerId || '',
        method: method || 'sms', status: (state.settings || {}).smsLive ? 'queued' : 'logged',
        campaignId: campaignId || '', gatewayId: '', cost: null, error: '',
      };
      state.messages = [msg, ...state.messages];
      save();
      if (window.SAFI_SMS) window.SAFI_SMS.kick();
      return msg;
    },
    queuedMessages() { return (state.messages || []).filter(m => m.status === 'queued').slice().reverse(); },
    updateMessages(patches) {
      if (!patches.length) return;
      const by = Object.fromEntries(patches.map(p => [p.id, p]));
      state.messages = state.messages.map(m => by[m.id] ? { ...m, ...by[m.id] } : m);
      save();
    },
    retryMessages(ids) {
      const set = new Set(ids);
      state.messages = state.messages.map(m => set.has(m.id) ? { ...m, status: 'queued', error: '' } : m);
      save();
      if (window.SAFI_SMS) window.SAFI_SMS.kick();
    },
    setSmsTemplate(key, body) {
      const next = { ...state.smsTemplates };
      if (body === undefined || body === null) delete next[key];
      else next[key] = body;
      state.smsTemplates = next;
      save();
    },

    // ── Pickup & Delivery dispatch ─────────────────────────
    addDispatch({ orderId, customerId, type, address, area, rider, slotDate, slotStart, slotEnd, notes }) {
      const id = nextId('dx');
      const d = {
        id, orderId: orderId || '', customerId: customerId || '',
        type: type || 'delivery', // 'pickup' or 'delivery'
        address: address || '', area: area || '',
        rider: rider || '', slotDate: slotDate || '', slotStart: slotStart || '', slotEnd: slotEnd || '',
        notes: notes || '', status: 'scheduled',
        created: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };
      state.dispatch = [d, ...state.dispatch];
      save();
      return d;
    },
    updateDispatch(id, patch) {
      if (patch.slotDate) patch = { ...patch, slotDateGuessed: false };
      state.dispatch = state.dispatch.map(d => d.id === id ? { ...d, ...patch } : d);
      save();
    },
    removeDispatch(id) {
      state.dispatch = state.dispatch.filter(d => d.id !== id);
      save();
    },

    // ── Active attendant ───────────────────────────────────
    // Saved in settings so it syncs: set Lydia at the shop and every laptop shows Lydia.
    setCurrentStaff(id) { state.currentStaffId = id; state.settings = { ...(state.settings || {}), currentStaffId: id }; save(); },
    getCurrentStaff() {
      const id = (state.settings && state.settings.currentStaffId) || state.currentStaffId || state.staff[0]?.id;
      return state.staff.find(s => s.id === id) || state.staff[0] || { name: 'Attendant', role: '—' };
    },

    // ── Staff ──────────────────────────────────────────────
    addStaff(s)   { const id = nextId('s'); state.staff = [...state.staff, { id, active: true, ...s }]; save(); return id; },
    updateStaff(id, patch) { state.staff = state.staff.map(s => s.id === id ? { ...s, ...patch } : s); save(); },
    removeStaff(id) { state.staff = state.staff.filter(s => s.id !== id); save(); },
    // Owner deletes. Orders keep their own record; the customer link just goes empty.
    removeCustomers(ids) {
      const set = new Set(ids);
      const gone = state.customers.filter(c => set.has(c.id));
      if (!gone.length) return 0;
      state.customers = state.customers.filter(c => !set.has(c.id));
      audit('customer.delete', gone.length === 1 ? gone[0].id : gone.length + ' customers',
        gone.slice(0, 20).map(c => c.name + ' ' + (c.phone || '')).join(', ') + (gone.length > 20 ? ' …' : ''));
      save();
      return gone.length;
    },
    // Empty one section. Audit log is never cleared.
    clearSection(key) {
      const linked = { orders: ['orders', 'payments', 'releases', 'deliveryCards'], dispatch: ['dispatch', 'deliveryCards'] };
      const keys = linked[key] || [key];
      const n = (state[key] || []).length;
      for (const k of keys) if (Array.isArray(state[k])) state[k] = [];
      if (key === 'orders') state.customers = state.customers.map(c => ({ ...c, orders: 0, spend: 0 }));
      audit('data.clear', key, `${n} row(s) cleared` + (keys.length > 1 ? ` (with ${keys.slice(1).join(', ')})` : ''));
      save();
      return n;
    },

    // ── Orders ─────────────────────────────────────────────
    createOrder({ customerId, items, total, discount, discountPct, paid, method, txn, notes, due, rewashOf, tag }) {
      const id = nextOrderId();
      const now = new Date();
      const fmt = (d) => SAFI_TIME.stamp(d);

      // Pre-existing customer counts (used to detect first-timer)
      const cust = customerId ? state.customers.find(c => c.id === customerId) : null;
      const isFirstTime = cust && cust.orders === 0;
      const finalItems = items.map(it => ({ svc: it.svc, subtype: it.subtype || '', qty: it.qty, price: it.price, free: it.free || false, note: it.note || '' }));

      // Auto-add free items based on order content
      if (!rewashOf) {
        // Rule 1: first-time customer gets a free LAUNDRY BAG (only if order has laundry items, gated by setting)
        const hasLaundry = finalItems.some(it => {
          const svc = state.services.find(s => s.id === it.svc);
          return svc?.category === 'laundry';
        });
        if (isFirstTime && state.settings?.firstTimeBagFree && hasLaundry) {
          const bagSvc = state.settings.freeBagServiceId || 'laundry-bag';
          const hasBag = finalItems.some(i => i.svc === bagSvc && i.free);
          if (!hasBag) finalItems.push({ svc: bagSvc, qty: 1, price: 0, free: true, note: 'Welcome gift — first laundry order' });
        }
        // Rule 2: any order with a dry cleaning item gets a free DRY CLEANING BAG (always)
        const hasDryClean = finalItems.some(it => {
          const svc = state.services.find(s => s.id === it.svc);
          return svc?.category === 'drycleaning';
        });
        if (hasDryClean && state.services.find(s => s.id === 'dryclean-bag')) {
          const hasDcBag = finalItems.some(i => i.svc === 'dryclean-bag' && i.free);
          if (!hasDcBag) finalItems.push({ svc: 'dryclean-bag', qty: 1, price: 0, free: true, note: 'Complimentary dry cleaning bag' });
        }
      }

      const order = {
        id,
        customer: customerId || '',
        items: finalItems,
        total: Math.round(total),
        discount: Math.round(discount || 0),
        discountPct: discountPct || 0,
        paid: Math.round(paid || 0),
        method: method || '—',
        txn: txn || '',
        status: 'intake',
        in: fmt(now),
        due: due || fmt(new Date(now.getTime() + 24 * 3600 * 1000)),
        notes: notes || '',
        rewashOf: rewashOf || '',
        tag: tag || '',
        queueNo: nextQueueNo(),
        shift: (state.shifts || []).find(s => !s.closedAt)?.id || '',
      };
      state.orders = [order, ...state.orders];

      // If a deposit/payment was recorded, also add to payments ledger
      if (paid > 0 && method && method !== '—') {
        state.payments = [{
          id: nextId('p'),
          date: fmt(now),
          order: id,
          customer: cust?.name || id,
          method, amount: Math.round(paid),
          txn: txn || '',
          verified: false,
        }, ...state.payments];
      }

      // Bump customer aggregate
      if (customerId) {
        state.customers = state.customers.map(c =>
          c.id === customerId ? { ...c, orders: c.orders + 1, spend: c.spend + Math.round(total) } : c
        );
      }
      // Tag who took the order
      if (state.currentStaffId) order.cashier = state.currentStaffId;
      order.priceModel = (state.settings || {}).activePriceModel || 'current';
      { const cu = state.customers.find(c => c.id === customerId); if (window.SAFI_PRICING && window.SAFI_PRICING.studentDayLive() && cu && cu.group === 'student') order.priceModel = 'student-thursday'; }
      audit('order.create', id, `${finalItems.length} line(s), total ${order.total}`, { tag: order.tag || '' });
      // Mark the parent order as having been rewashed
      if (rewashOf) {
        state.orders = state.orders.map(o => o.id === rewashOf ? { ...o, rewashedBy: id } : o);
      }
      save();
      return order;
    },
    updateOrder(id, patch) {
      const before = state.orders.find(o => o.id === id);
      state.orders = state.orders.map(o => o.id === id ? { ...o, ...patch } : o);
      if (before) {
        const changed = Object.keys(patch).filter(k => String(before[k]) !== String(patch[k]));
        if (changed.length) {
          audit('order.edit', id, changed.map(k => `${k}: ${before[k] ?? '—'} → ${patch[k]}`).join('; '),
            { afterCollection: before.status === 'collected' });
        }
      }
      save();
    },
    advanceStatus(id) {
      state.orders = state.orders.map(o => {
        if (o.id !== id) return o;
        const idx = STAGES.indexOf(o.status);
        return { ...o, status: STAGES[Math.min(idx + 1, STAGES.length - 1)] };
      });
      save();
    },
    setStatus(id, status) {
      const before = state.orders.find(o => o.id === id);
      state.orders = state.orders.map(o => o.id === id ? { ...o, status } : o);
      audit('order.status', id, `${before?.status || '—'} → ${status}`);
      save();
    },
    deleteOrder(id) {
      const o = state.orders.find(x => x.id === id);
      if (!o) return;
      // Undo customer aggregate
      if (o.customer) {
        state.customers = state.customers.map(c =>
          c.id === o.customer
            ? { ...c, orders: Math.max(0, c.orders - 1), spend: Math.max(0, c.spend - o.total) }
            : c
        );
      }
      // Remove associated payments
      state.payments = state.payments.filter(p => p.order !== id);
      // Remove order — the row goes, the record of its going does not
      audit('order.delete', id, `Total ${o.total}, paid ${o.paid || 0}, status ${o.status}`,
        { tag: o.tag || '', total: o.total, paid: o.paid || 0 });
      state.orders = state.orders.filter(x => x.id !== id);
      save();
    },

    // ── Rewash (free redo) ─────────────────────────────────
    createRewash(originalOrderId, itemSelections) {
      const orig = state.orders.find(o => o.id === originalOrderId);
      if (!orig) return null;
      // itemSelections is array of indices into orig.items, or null = all
      const selected = itemSelections && itemSelections.length
        ? itemSelections.map(i => orig.items[i]).filter(Boolean)
        : orig.items;
      const items = selected.map(it => ({ svc: it.svc, qty: it.qty, price: 0, free: true, note: 'Rewash — no charge' }));
      return this.createOrder({
        customerId: orig.customer,
        items, total: 0, discount: 0, discountPct: 0,
        paid: 0, method: '—', txn: '', notes: `Rewash of ${originalOrderId}`,
        rewashOf: originalOrderId,
      });
    },

    // ── Approvals queue (management approval for destructive actions) ────
    requestApproval({ action, target, reason, payload }) {
      const now = new Date();
      const fmt = SAFI_TIME.stamp(now);
      const a = {
        id: nextId('ap'), action, target,
        reason: reason || '',
        payload: payload || null,
        status: 'pending',
        requestedBy: state.currentStaffId || '',
        requestedAt: fmt,
        decidedBy: '', decidedAt: '', decisionNote: '',
      };
      state.approvals = [a, ...state.approvals];
      save();
      // Send it to the cloud straight away so Management sees it within seconds.
      setTimeout(() => window.SAFI_CLOUD && window.SAFI_CLOUD.syncNow && window.SAFI_CLOUD.syncNow().catch(() => {}), 300);
      return a;
    },
    decideApproval(id, decision, note) {
      const now = new Date();
      const fmt = SAFI_TIME.stamp(now);
      const ap = state.approvals.find(a => a.id === id);
      if (!ap) return;
      ap.status = decision;
      ap.decidedAt = fmt;
      ap.decidedBy = state.currentStaffId || '';
      ap.decisionNote = note || '';
      if (decision === 'approved') {
        if (ap.action === 'delete_order')      this.deleteOrder(ap.target);
        else if (ap.action === 'rewash_order') this.createRewash(ap.target, ap.payload?.itemIndices);
        else if (ap.action === 'edit_order')   this.updateOrder(ap.target, ap.payload || {});
        else if (ap.action === 'refund_order') this.updateOrder(ap.target, { status: 'collected', paid: 0, refunded: true });
      }
      save();
    },

    // ── Settings (in-store, distinct from cosmetic tweaks) ─
    setSetting(key, value) {
      state.settings = { ...(state.settings || {}), [key]: value };
      save();
    },
    getSettings() { return state.settings || {}; },
    activatePriceModel(id) {
      const from = (state.settings || {}).activePriceModel || 'current';
      if (from === id) return;
      state.settings = { ...(state.settings || {}), activePriceModel: id };
      audit('pricing.activate', id, `Price model ${from} → ${id}`);
      save();
    },
    savePriceModels(list) {
      state.settings = { ...(state.settings || {}), priceModels: list };
      audit('pricing.edit', 'models', `${list.length} price model(s) saved`);
      save();
    },

    // ── Customers ──────────────────────────────────────────
    addCustomer({ name, phone, prefix, group, location }) {
      const id = nextId('c');
      const today = SAFI_TIME.day();
      const c = { id, name, phone: SAFI_PHONE(prefix || '+254', phone), prefix: prefix || '+254', group: group || 'normal', location: location || '', joined: today, orders: 0, spend: 0, loyalty: 0 };
      state.customers = [c, ...state.customers];
      save();
      return c;
    },
    updateCustomer(id, patch) {
      state.customers = state.customers.map(c => {
        if (c.id !== id) return c;
        const n = { ...c, ...patch };
        if ('phone' in patch || 'prefix' in patch) n.phone = SAFI_PHONE(n.prefix || '+254', n.phone);
        return n;
      });
      save();
    },
    importCustomers(rows) {
      const today = SAFI_TIME.day();
      const added = rows.map((r) => {
        // Auto-format phone with spaces based on prefix
        let digits = (r.phone || '').replace(/\D/g, '');
        // A leading 0 is a local-dialling artefact — the prefix replaces it.
        if (digits.length > 9 && digits[0] === '0') digits = digits.replace(/^0+/, '');
        let formatted = digits;
        if (!r.prefix || String(r.prefix).replace(/\D/g, '') === '254') {
          if (digits.length === 9) formatted = digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
          else formatted = digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
        } else {
          formatted = digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
        }
        return {
          id: nextId('c'),
          name: r.name,
          prefix: !r.prefix ? '+254' : /^\d+$/.test(String(r.prefix).trim()) ? '+' + String(r.prefix).trim() : String(r.prefix).trim(),
          phone: formatted,
          group: r.group || 'normal',
          location: r.location || '',
          joined: today, orders: 0, spend: 0, loyalty: 0,
        };
      });
      added.forEach(a => { a.phone = SAFI_PHONE(a.prefix, a.phone); });
      state.customers = [...added, ...state.customers];
      save();
      return added.length;
    },

    // ── Payments ───────────────────────────────────────────
    recordPayment({ orderId, method, amount, txn, customer }) {
      const now = new Date();
      const fmt = SAFI_TIME.stamp(now);
      const p = {
        id: nextId('p'), date: fmt, order: orderId,
        customer: customer || '', method, amount: Math.round(amount),
        txn: txn || '', verified: false,
      };
      state.payments = [p, ...state.payments];
      audit('payment.record', orderId, `${method} ${Math.round(amount)}${txn ? ` (${txn})` : ''}`);
      // Update order
      state.orders = state.orders.map(o =>
        o.id === orderId
          ? { ...o, paid: (o.paid || 0) + Math.round(amount), method, txn: txn || o.txn }
          : o
      );
      save();
      return p;
    },
    verifyPayment(id) {
      const p = state.payments.find(x => x.id === id);
      state.payments = state.payments.map(x => x.id === id ? { ...x, verified: true } : x);
      audit('payment.verify', p?.order || id, `${p?.method || ''} ${p?.amount || ''}`);
      save();
    },

    // ── Expenses ───────────────────────────────────────────
    addExpense({ category, label, amount, method, txn, paidBy, notes, linkedOrder, linkedCustomer }) {
      const now = new Date();
      const fmt = SAFI_TIME.stamp(now);
      const e = {
        id: nextId('ex'), date: fmt, category, label,
        amount: Math.round(amount), method: method || 'cash',
        txn: txn || '', paidBy: paidBy || state.currentStaffId || '',
        notes: notes || '',
        linkedOrder: linkedOrder || '',
        linkedCustomer: linkedCustomer || '',
      };
      state.expenses = [e, ...state.expenses];
      save();
      return e;
    },
    updateExpense(id, patch) {
      state.expenses = state.expenses.map(e => e.id === id ? { ...e, ...patch } : e);
      save();
    },
    removeExpense(id) {
      state.expenses = state.expenses.filter(e => e.id !== id);
      save();
    },

    addExpenseCategory({ name, icon, color }) {
      const id = nextId('ec');
      state.expenseCategories = [...state.expenseCategories, { id, name, icon: icon || 'package', color: color || 'gray' }];
      save();
      return id;
    },
    updateExpenseCategory(id, patch) {
      state.expenseCategories = state.expenseCategories.map(c => c.id === id ? { ...c, ...patch } : c);
      save();
    },
    removeExpenseCategory(id) {
      state.expenseCategories = state.expenseCategories.filter(c => c.id !== id);
      save();
    },

    // ── Services & pricing ─────────────────────────────────
    addService({ name, unit, tiers, icon }) {
      const id = nextId('svc');
      state.services = [...state.services, { id, name, unit, icon: icon || 'shirt', tiers: tiers || { student: 0, normal: 0, corporate: 0 } }];
      save();
    },
    updateService(id, patch) {
      state.services = state.services.map(s => s.id === id ? { ...s, ...patch } : s);
      save();
    },

    // ── Packages & discounts ───────────────────────────────
    updatePackage(id, patch) { state.packages = state.packages.map(p => p.id === id ? { ...p, ...patch } : p); save(); },
    addPackage(p)    { state.packages  = [...state.packages,  { id: nextId('pk'), subscribers: 0, active: true, ...p }]; save(); },
    addDiscount(d)   { state.discounts = [...state.discounts, { id: nextId('d'),  uses: 0, ...d }]; save(); },

    // ── Inventory ──────────────────────────────────────────
    addInventory(i)  { state.inventory = [...state.inventory, { id: nextId('i'), ...i }]; save(); },
    updateInventory(id, patch) {
      state.inventory = state.inventory.map(i => i.id === id ? { ...i, ...patch } : i);
      save();
    },

    // ── Issues ─────────────────────────────────────────────
    addIssue({ subject, priority, status, order, raisedBy, details }) {
      const now = new Date();
      const fmt = SAFI_TIME.stamp(now);
      const i = {
        id: nextId('is'), date: fmt, subject,
        priority: priority || 'medium', status: status || 'open',
        order: order || '', raisedBy: raisedBy || 'Grace Wairimu',
        details: details || '',
      };
      state.issues = [i, ...state.issues];
      save();
      return i;
    },
    updateIssue(id, patch) {
      state.issues = state.issues.map(i => i.id === id ? { ...i, ...patch } : i);
      save();
    },

    // ── Data management ────────────────────────────────────
    snapshot() { return JSON.stringify(state); },
    exportJSON() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = SAFI_TIME.day();
      a.href = url;
      a.download = `vazi-safi-backup-${date}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    importJSON(text) {
      try {
        const next = JSON.parse(text);
        if (!next.orders || !next.customers) throw new Error('Invalid backup file');
        state = next;
        save();
        return true;
      } catch (e) { return false; }
    },
    resetAll() { state = clone(SAMPLE); save(); },

    // Wipe every trace of sample/demo activity and start the books at zero.
    // Keeps only the setup you configured: services & pricing, staff, expense
    // categories, packages, discounts. Ready for a real customer import.
    goLive() {
      state = {
        ...state,
        customers: [],
        orders: [],
        payments: [],
        expenses: [],
        issues: [],
        messages: [],
        dispatch: [],
        approvals: [],
        auditLog: [],
        shifts: [],
        releases: [],
        deliveryCards: [],
        queueNoFixed: true,
        voidTags: [],
        revenueTrend: (state.revenueTrend || []).map(d => ({ ...d, v: 0 })),
        revenueByService: (state.revenueByService || []).map(d => ({ ...d, value: 0, pct: 0 })),
        revenueByMethod: (state.revenueByMethod || []).map(d => ({ ...d, value: 0, pct: 0 })),
      };
      save();
    },

    clearAll() {
      state = {
        ...clone(SAMPLE),
        orders: [], payments: [], issues: [],
        customers: state.customers, // keep customers
      };
      save();
    },

    // Stage constants (for screens)
    STAGES,
  };
})();
