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
  if (state.settings.requireTag === undefined) state.settings.requireTag = true;
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

  // Backfill the daily client queue number on orders saved before it existed
  {
    const byDay = {};
    // state.orders is newest-first by id, not chronological, so sort on the timestamp
    const asc = [...state.orders].sort((a, b) => String(a.in || '').localeCompare(String(b.in || '')));
    for (const o of asc) {
      const day = String(o.in || '').slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      if (!o.queueNo) { o.queueNo = byDay[day]; migrated = true; }
    }
  }
  const listeners = new Set();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Safi: storage full', e); }
    listeners.forEach(fn => fn(state));
  }
  // Persist any migration changes immediately
  if (migrated) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ID helpers
  const nextOrderId = () => {
    const max = state.orders.reduce((m, o) => {
      const n = parseInt(o.id.replace(/\D/g, ''), 10) || 0;
      return n > m ? n : m;
    }, 2400);
    return `SF-${max + 1}`;
  };
  const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`;

  // Client number: position in today's queue. Resets each morning, so "client 7" means
  // the seventh customer served today — what staff and customers actually say out loud.
  const nextQueueNo = () => {
    const today = new Date().toISOString().slice(0, 10);
    return state.orders.filter(o => String(o.in || '').startsWith(today)).length + 1;
  };

  const STAGES = ['intake', 'washing', 'drying', 'ironing', 'ready', 'collected'];

  const stamp = (d) => (d || new Date()).toISOString().slice(0, 16).replace('T', ' ');

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
      const from = sh.openedAt, to = sh.closedAt || new Date().toISOString();
      const inWin = (iso) => iso >= from && iso <= to;
      const toIso = (d) => (d || '').replace(' ', 'T');
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
      const today = new Date().toISOString().slice(0, 10);
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
    logMessage({ to, name, body, orderId, stage, method }) {
      const now = new Date();
      const fmt = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);
      const msg = {
        id: nextId('msg'), date: fmt, to, name, body,
        orderId: orderId || '', stage: stage || '',
        method: method || 'sms', status: 'sent',
      };
      state.messages = [msg, ...state.messages];
      save();
      return msg;
    },
    setSmsTemplate(key, body) {
      const next = { ...state.smsTemplates };
      if (body === undefined || body === null) delete next[key];
      else next[key] = body;
      state.smsTemplates = next;
      save();
    },

    // ── Pickup & Delivery dispatch ─────────────────────────
    addDispatch({ orderId, customerId, type, address, area, rider, slotStart, slotEnd, notes }) {
      const id = nextId('dx');
      const d = {
        id, orderId: orderId || '', customerId: customerId || '',
        type: type || 'delivery', // 'pickup' or 'delivery'
        address: address || '', area: area || '',
        rider: rider || '', slotStart: slotStart || '', slotEnd: slotEnd || '',
        notes: notes || '', status: 'scheduled',
        created: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };
      state.dispatch = [d, ...state.dispatch];
      save();
      return d;
    },
    updateDispatch(id, patch) {
      state.dispatch = state.dispatch.map(d => d.id === id ? { ...d, ...patch } : d);
      save();
    },
    removeDispatch(id) {
      state.dispatch = state.dispatch.filter(d => d.id !== id);
      save();
    },

    // ── Active attendant ───────────────────────────────────
    setCurrentStaff(id) { state.currentStaffId = id; save(); },
    getCurrentStaff() {
      const id = state.currentStaffId || state.staff[0]?.id;
      return state.staff.find(s => s.id === id) || state.staff[0] || { name: 'Attendant', role: '—' };
    },

    // ── Staff ──────────────────────────────────────────────
    addStaff(s)   { const id = nextId('s'); state.staff = [...state.staff, { id, active: true, ...s }]; save(); return id; },
    updateStaff(id, patch) { state.staff = state.staff.map(s => s.id === id ? { ...s, ...patch } : s); save(); },
    removeStaff(id) { state.staff = state.staff.filter(s => s.id !== id); save(); },

    // ── Orders ─────────────────────────────────────────────
    createOrder({ customerId, items, total, discount, discountPct, paid, method, txn, notes, due, rewashOf, tag }) {
      const id = nextOrderId();
      const now = new Date();
      const fmt = (d) => d.toISOString().slice(0, 10) + ' ' + d.toTimeString().slice(0, 5);

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
          const hasBag = finalItems.some(i => i.svc === bagSvc);
          if (!hasBag) finalItems.push({ svc: bagSvc, qty: 1, price: 0, free: true, note: 'Welcome gift — first laundry order' });
        }
        // Rule 2: any order with a dry cleaning item gets a free DRY CLEANING BAG (always)
        const hasDryClean = finalItems.some(it => {
          const svc = state.services.find(s => s.id === it.svc);
          return svc?.category === 'drycleaning';
        });
        if (hasDryClean && state.services.find(s => s.id === 'dryclean-bag')) {
          const hasDcBag = finalItems.some(i => i.svc === 'dryclean-bag');
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
          customer: cust?.name || 'Walk-in',
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
      const fmt = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);
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
      return a;
    },
    decideApproval(id, decision, note) {
      const now = new Date();
      const fmt = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);
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

    // ── Customers ──────────────────────────────────────────
    addCustomer({ name, phone, prefix, group, location }) {
      const id = nextId('c');
      const today = new Date().toISOString().slice(0, 10);
      const c = { id, name, phone, prefix: prefix || '+254', group: group || 'normal', location: location || '', joined: today, orders: 0, spend: 0, loyalty: 0 };
      state.customers = [c, ...state.customers];
      save();
      return c;
    },
    updateCustomer(id, patch) {
      state.customers = state.customers.map(c => c.id === id ? { ...c, ...patch } : c);
      save();
    },
    importCustomers(rows) {
      const today = new Date().toISOString().slice(0, 10);
      const added = rows.map((r) => {
        // Auto-format phone with spaces based on prefix
        let digits = (r.phone || '').replace(/\D/g, '');
        // A leading 0 is a local-dialling artefact — the prefix replaces it.
        if (digits.length > 9 && digits[0] === '0') digits = digits.replace(/^0+/, '');
        let formatted = digits;
        if (r.prefix === '+254' || !r.prefix) {
          if (digits.length === 9) formatted = digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
          else formatted = digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
        } else {
          formatted = digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
        }
        return {
          id: 'c-' + Date.now().toString(36) + Math.floor(Math.random() * 999),
          name: r.name,
          prefix: r.prefix || '+254',
          phone: formatted,
          group: r.group || 'normal',
          location: r.location || '',
          joined: today, orders: 0, spend: 0, loyalty: 0,
        };
      });
      state.customers = [...added, ...state.customers];
      save();
      return added.length;
    },

    // ── Payments ───────────────────────────────────────────
    recordPayment({ orderId, method, amount, txn, customer }) {
      const now = new Date();
      const fmt = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);
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
      const fmt = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);
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
      const fmt = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);
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
      const date = new Date().toISOString().slice(0, 10);
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
