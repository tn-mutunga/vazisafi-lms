// Vazi Safi — per-table cloud sync.
//
// The snapshot backup in cloud.js answers "can I get the shop back if this laptop
// dies". This file answers the other question: "can two tills, or the owner at home,
// see the same books". It maps every local collection onto the relational schema in
// supabase/01_schema.sql and moves rows both ways.
//
// Off by default. Nothing here runs until the owner turns Live sync on, and if it
// fails the app keeps working exactly as it did — localStorage stays the source of
// truth on the machine, the cloud is a mirror.

(function () {
  const C = () => window.SAFI_CLOUD;
  const S = () => window.SAFI_STORE;
  const CHUNK = 200;

  // ── value helpers ───────────────────────────────────────────────────
  const n = (v) => Math.round(Number(v) || 0);
  const s = (v) => (v == null ? '' : String(v));
  // The app stores 'YYYY-MM-DD HH:mm' in shop (Nairobi) time, or a full ISO string
  // which is already UTC. Postgres reads an offset-less string as UTC, so the short
  // form needs +03:00 or every order lands three hours early.
  const ts = (v) => {
    if (!v) return null;
    const str = String(v);
    if (str.includes('T')) return str;
    const m = str.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
    if (m) return `${m[1]}T${m[2]}:00+03:00`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str + 'T00:00:00+03:00';
    return null;
  };
  // For columns that may not be null: fall back to now rather than fail the push.
  const tsNow = (v) => ts(v) || new Date().toISOString();
  // Cloud returns timestamptz in UTC ("...T06:30:00+00:00"). Convert to shop-local
  // "YYYY-MM-DD HH:MM"; slicing the string kept UTC time and could move the day.
  const fromTs = (v) => {
    if (!v) return '';
    const str = String(v);
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(str)) { const d = new Date(str); if (!isNaN(d)) return SAFI_TIME.stamp(d); }
    return str.slice(0, 16).replace('T', ' ');
  };
  const day = (v) => (v ? String(v).slice(0, 10) : null);

  let BRANCH = 'main';

  // ── the map ─────────────────────────────────────────────────────────
  // Order matters: parents before children, so foreign keys hold on first push.
  const TABLES = [
    {
      key: 'services', table: 'services', pk: 'id',
      up: (r) => ({ id: r.id, name: r.name, category: r.category || 'other', unit: r.unit || 'item',
        icon: r.icon || 'shirt', tiers: r.tiers || {}, subtypes: r.subtypes || [], active: r.active !== false }),
      down: (r) => ({ id: r.id, name: r.name, category: r.category, unit: r.unit, icon: r.icon,
        tiers: r.tiers || {}, subtypes: r.subtypes || [] }),
    },
    {
      key: 'expenseCategories', table: 'expense_categories', pk: 'id',
      up: (r) => ({ id: r.id, name: r.name, icon: r.icon || 'package', color: r.color || 'gray' }),
      down: (r) => ({ id: r.id, name: r.name, icon: r.icon, color: r.color }),
    },
    {
      key: 'staff', table: 'staff', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, name: r.name, role: s(r.role), phone: s(r.phone), active: r.active !== false }),
      down: (r) => ({ id: r.id, name: r.name, role: r.role, phone: r.phone, active: r.active }),
    },
    {
      key: 'customers', table: 'customers', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, name: r.name, prefix: r.prefix || '+254', phone: s(r.phone),
        segment: r.group || 'normal', location: s(r.location), joined: day(r.joined),
        orders_count: n(r.orders), spend: n(r.spend), loyalty: n(r.loyalty) }),
      down: (r) => ({ id: r.id, name: r.name, prefix: r.prefix, phone: r.phone, group: r.segment,
        location: r.location, joined: r.joined, orders: r.orders_count, spend: Number(r.spend), loyalty: r.loyalty }),
    },
    {
      key: 'orders', table: 'orders', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, origin_id: BRANCH, customer_id: r.customer || null,
        status: r.status || 'intake', queue_no: r.queueNo || null, tag: s(r.tag),
        total: n(r.total), discount: n(r.discount), discount_pct: Number(r.discountPct) || 0,
        paid: n(r.paid), method: r.method === '—' ? '' : s(r.method), txn: s(r.txn), notes: s(r.notes),
        rewash_of: r.rewashOf || null, rewashed_by: r.rewashedBy || null,
        cashier_id: r.cashier || null, shift_id: r.shift || null,
        received_at: tsNow(r.in), due_at: ts(r.due) }),
      down: (r) => ({ id: r.id, customer: r.customer_id || '', status: r.status, queueNo: r.queue_no,
        tag: r.tag, total: Number(r.total), discount: Number(r.discount), discountPct: Number(r.discount_pct),
        paid: Number(r.paid), method: r.method || '—', txn: r.txn, notes: r.notes,
        rewashOf: r.rewash_of || '', rewashedBy: r.rewashed_by || '', cashier: r.cashier_id || '',
        shift: r.shift_id || '', in: fromTs(r.received_at), due: fromTs(r.due_at), items: [] }),
    },
    {
      key: 'payments', table: 'payments', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, order_id: r.order || null, customer: s(r.customer),
        method: r.method || 'cash', amount: n(r.amount), txn: s(r.txn), verified: !!r.verified,
        paid_at: tsNow(r.date) }),
      down: (r) => ({ id: r.id, date: fromTs(r.paid_at), order: r.order_id || '', customer: r.customer,
        method: r.method, amount: Number(r.amount), txn: r.txn, verified: r.verified }),
    },
    {
      key: 'expenses', table: 'expenses', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, category_id: r.category || null, label: s(r.label) || '—',
        amount: n(r.amount), method: r.method || 'cash', txn: s(r.txn), paid_by: s(r.paidBy),
        notes: s(r.notes), linked_order: r.linkedOrder || null, linked_customer: r.linkedCustomer || null,
        spent_at: tsNow(r.date) }),
      down: (r) => ({ id: r.id, date: fromTs(r.spent_at), category: r.category_id || '', label: r.label,
        amount: Number(r.amount), method: r.method, txn: r.txn, paidBy: r.paid_by, notes: r.notes,
        linkedOrder: r.linked_order || '', linkedCustomer: r.linked_customer || '' }),
    },
    {
      key: 'shifts', table: 'shifts', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, staff_id: r.staff || null, opened_at: tsNow(r.openedAt),
        opening_float: n(r.openingFloat), closed_at: ts(r.closedAt), declared_cash: n(r.declaredCash),
        expected_cash: n(r.expectedCash), variance: n(r.variance), note: s(r.note) }),
      down: (r) => ({ id: r.id, staff: r.staff_id || '', openedAt: r.opened_at, openedAtLabel: fromTs(r.opened_at),
        openingFloat: Number(r.opening_float), closedAt: r.closed_at || '', closedAtLabel: fromTs(r.closed_at),
        declaredCash: Number(r.declared_cash), expectedCash: Number(r.expected_cash),
        variance: Number(r.variance), note: r.note }),
    },
    {
      key: 'dispatch', table: 'dispatch', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, order_id: r.orderId || null, customer_id: r.customerId || null,
        kind: r.type === 'pickup' ? 'pickup' : 'delivery', address: s(r.address), area: s(r.area),
        rider: s(r.rider), slot_start: s(r.slotStart), slot_end: s(r.slotEnd), notes: s(r.notes),
        status: r.status || 'scheduled', created_at: tsNow(r.created) }),
      down: (r) => ({ id: r.id, orderId: r.order_id || '', customerId: r.customer_id || '', type: r.kind,
        address: r.address, area: r.area, rider: r.rider, slotStart: r.slot_start, slotEnd: r.slot_end,
        notes: r.notes, status: r.status, created: fromTs(r.created_at) }),
    },
    {
      key: 'deliveryCards', table: 'delivery_cards', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, serial: r.serial, order_id: r.order || null,
        dispatch_id: r.dispatch || null, customer_id: r.customer || null, rider: s(r.rider), tag: s(r.tag),
        queue_no: r.queueNo || null, amount_due: n(r.amountDue), issued_at: tsNow(r.issuedAt),
        issued_by: s(r.issuedBy), returned_at: ts(r.returnedAt), returned_by: s(r.returnedBy),
        received_amount: n(r.receivedAmount), received_method: s(r.receivedMethod),
        received_txn: s(r.receivedTxn), note: s(r.note) }),
      down: (r) => ({ id: r.id, serial: r.serial, order: r.order_id || '', dispatch: r.dispatch_id || '',
        customer: r.customer_id || '', rider: r.rider, tag: r.tag, queueNo: r.queue_no,
        amountDue: Number(r.amount_due), issuedAt: r.issued_at, issuedAtLabel: fromTs(r.issued_at),
        issuedBy: r.issued_by, returnedAt: r.returned_at || '', returnedAtLabel: fromTs(r.returned_at),
        returnedBy: r.returned_by, receivedAmount: Number(r.received_amount),
        receivedMethod: r.received_method, receivedTxn: r.received_txn, note: r.note }),
    },
    {
      key: 'releases', table: 'releases', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, order_id: r.order || null, tag: s(r.tag),
        released_to: s(r.releasedTo), staff_id: s(r.staff), balance_at_release: n(r.balanceAtRelease), at: tsNow(r.at) }),
      down: (r) => ({ id: r.id, at: r.at, atLabel: fromTs(r.at), order: r.order_id || '', tag: r.tag,
        releasedTo: r.released_to, staff: r.staff_id, balanceAtRelease: Number(r.balance_at_release) }),
    },
    {
      key: 'messages', table: 'messages', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, order_id: r.orderId || null, to_phone: s(r.to),
        name: s(r.name), body: s(r.body) || '—', stage: s(r.stage), method: r.method || 'sms',
        status: r.status || 'sent', sent_at: tsNow(r.date), gateway_id: s(r.gatewayId),
        cost: r.cost == null ? null : Number(r.cost) }),
      down: (r) => ({ id: r.id, date: fromTs(r.sent_at), to: r.to_phone, name: r.name, body: r.body,
        orderId: r.order_id || '', stage: r.stage, method: r.method, status: r.status,
        gatewayId: r.gateway_id || '', cost: r.cost == null ? null : Number(r.cost), error: r.error || '', campaignId: r.campaign_id || '' }),
    },
    {
      key: 'inventory', table: 'inventory', pk: 'id', branch: true,
      // Local stock rows are { item, stock, reorder, unit }.
      up: (r) => ({ id: r.id, branch_id: BRANCH, name: s(r.item ?? r.name) || '—', unit: r.unit || 'unit',
        qty: Number(r.stock ?? r.qty) || 0, reorder_at: Number(r.reorder ?? r.reorderAt) || 0,
        cost: n(r.cost), supplier: s(r.supplier) }),
      down: (r) => ({ id: r.id, item: r.name, unit: r.unit, stock: Number(r.qty),
        reorder: Number(r.reorder_at), cost: Number(r.cost), supplier: r.supplier }),
    },
    {
      key: 'issues', table: 'issues', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, order_id: r.order || null, subject: r.subject || '—',
        priority: r.priority || 'medium', status: r.status || 'open', raised_by: s(r.raisedBy),
        details: s(r.details), raised_at: tsNow(r.date) }),
      down: (r) => ({ id: r.id, date: fromTs(r.raised_at), order: r.order_id || '', subject: r.subject,
        priority: r.priority, status: r.status, raisedBy: r.raised_by, details: r.details }),
    },
    {
      key: 'approvals', table: 'approvals', pk: 'id', branch: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, action: r.action, target: s(r.target),
        reason: s(r.reason), payload: r.payload || null, status: r.status || 'pending',
        requested_by: s(r.requestedBy), requested_at: tsNow(r.requestedAt),
        decided_by: s(r.decidedBy), decided_at: ts(r.decidedAt), decision_note: s(r.decisionNote) }),
      down: (r) => ({ id: r.id, action: r.action, target: r.target, reason: r.reason, payload: r.payload,
        status: r.status, requestedBy: r.requested_by, requestedAt: fromTs(r.requested_at),
        decidedBy: r.decided_by, decidedAt: fromTs(r.decided_at), decisionNote: r.decision_note }),
    },
    {
      key: 'auditLog', table: 'audit_log', pk: 'id', branch: true, appendOnly: true,
      up: (r) => ({ id: r.id, branch_id: BRANCH, at: tsNow(r.at), staff_id: s(r.staff),
        action: r.action, target: s(r.target), detail: s(r.detail), meta: r.meta || null }),
      down: (r) => ({ id: r.id, at: r.at, staff: r.staff_id, action: r.action, target: r.target,
        detail: r.detail, meta: r.meta }),
    },
  ];

  // Reference data only the owner login may change. The till login skips these
  // quietly instead of failing the whole push.
  const OWNER_ONLY = new Set(['services', 'expense_categories']);

  // The laptop can delete a customer, staff member or service that older rows still
  // point at. The cloud enforces those links, so a dangling one is cleared to null
  // before sending — the row keeps its text copy (customer name etc.) either way.
  function clearDangling(table, rows, ids) {
    const keep = (field, set) => rows.forEach(r => { if (r[field] && !set.has(r[field])) r[field] = null; });
    if (table === 'orders')         { keep('customer_id', ids.customers); keep('cashier_id', ids.staff); }
    if (table === 'payments')       keep('order_id', ids.orders);
    if (table === 'expenses')       keep('category_id', ids.expenseCategories);
    if (table === 'dispatch')       { keep('order_id', ids.orders); keep('customer_id', ids.customers); }
    if (table === 'delivery_cards') { keep('order_id', ids.orders); keep('dispatch_id', ids.dispatch); }
    if (table === 'releases')       keep('order_id', ids.orders);
    return rows;
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async function upsert(table, rows, onConflict) {
    if (!rows.length) return 0;
    // Postgres refuses a batch that touches the same row twice. Keep the last copy.
    const keys = String(onConflict).split(',');
    const byKey = new Map();
    for (const r of rows) byKey.set(keys.map(k => r[k]).join('\u0001'), r);
    rows = [...byKey.values()];
    let done = 0;
    for (const part of chunk(rows, CHUNK)) {
      await C().raw(`/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(part),
      });
      done += part.length;
    }
    return done;
  }

  // Append-only tables reject an update, so a re-push of an existing id must be
  // ignored rather than merged.
  async function insertIgnore(table, rows, onConflict) {
    if (!rows.length) return 0;
    let done = 0;
    for (const part of chunk(rows, CHUNK)) {
      await C().raw(`/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(part),
      });
      done += part.length;
    }
    return done;
  }

  async function selectAll(table, order) {
    const rows = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const part = await C().raw(
        `/rest/v1/${table}?select=*${order ? `&order=${order}` : ''}`,
        { method: 'GET', headers: { Range: `${from}-${from + page - 1}` } }
      );
      if (!part || !part.length) break;
      rows.push(...part);
      if (part.length < page) break;
    }
    return rows;
  }

  // ── two-way state ────────────────────────────────────────────────
  // h: per table, id → fingerprint of the row as it last matched the cloud. A local
  //    row whose fingerprint differs has changed here and needs sending.
  // cur: per table, the newest cloud updated_at already downloaded.
  const BASE_KEY = () => 'safi_sync_base_v1_' + BRANCH;
  const H = (o) => { const str = JSON.stringify(o); let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + str.length.toString(36); };
  function loadBase() {
    try {
      const b = JSON.parse(localStorage.getItem(BASE_KEY())) || null;
      // v2.1.3: earlier pulls stored UTC times. Re-download everything once with the fix.
      if (b && !localStorage.getItem('safi_tz_fix_v1_' + BRANCH)) { b.cur = {}; localStorage.setItem('safi_tz_fix_v1_' + BRANCH, '1'); localStorage.setItem(BASE_KEY(), JSON.stringify(b)); }
      return b;
    } catch (e) { return null; }
  }
  function saveBase(b) { try { localStorage.setItem(BASE_KEY(), JSON.stringify(b)); } catch (e) {} }
  const newBase = () => ({ setup: true, h: {}, cur: {} });
  const tick = (b, table, rows) => { for (const r of rows) if (r.updated_at && (!b.cur[table] || r.updated_at > b.cur[table])) b.cur[table] = r.updated_at; };
  const EXTRA = {
    settings:      { list: st => Object.entries(st.settings || {}).map(([key, value]) => ({ branch_id: BRANCH, key, value })), id: r => r.key, conflict: 'branch_id,key' },
    sms_templates: { list: st => Object.entries(st.smsTemplates || {}).map(([key, body]) => ({ branch_id: BRANCH, key, body })), id: r => r.key, conflict: 'branch_id,key' },
    void_tags:     { list: st => (st.voidTags || []).map(v => ({ branch_id: BRANCH, tag: String(v.tag), reason: s(v.reason), staff_id: s(v.staff), at: ts(v.at) })), id: r => r.tag, conflict: 'branch_id,tag' },
  };
  // Rows written by another computer can land with an updated_at slightly older than
  // our cursor (clock drift / transaction timing) and would be skipped forever.
  // So: the first pull of each app session re-reads everything, and later pulls
  // overlap the cursor by 30 minutes. Re-reading a row is harmless.
  const fullPulled = new Set();
  const OVERLAP_MS = 30 * 60 * 1000;
  async function selectSince(table, cur, branchOnly) {
    const rows = [];
    const page = 1000;
    let q = `/rest/v1/${table}?select=*&order=updated_at.asc`;
    if (!fullPulled.has(table)) { fullPulled.add(table); cur = null; }
    if (cur) {
      const t = Date.parse(cur);
      if (!isNaN(t)) cur = new Date(t - OVERLAP_MS).toISOString();
      q += `&updated_at=gt.${encodeURIComponent(cur)}`;
    }
    if (branchOnly) q += `&branch_id=eq.${encodeURIComponent(BRANCH)}`;
    for (let from = 0; ; from += page) {
      const part = await C().raw(q, { method: 'GET', headers: { Range: `${from}-${from + page - 1}` } });
      if (!part || !part.length) break;
      rows.push(...part);
      if (part.length < page) break;
    }
    return rows;
  }
  async function itemsFor(orderIds) {
    const out = {};
    for (const part of chunk(orderIds, 100)) {
      const list = part.map(id => `"${id}"`).join(',');
      const rows = await C().raw(`/rest/v1/order_items?select=*&order_id=in.(${list})&order=order_id,line_no`, { method: 'GET' });
      for (const it of rows || []) (out[it.order_id] = out[it.order_id] || []).push({
        svc: it.service_id, subtype: it.subtype || '', qty: Number(it.qty),
        price: Number(it.price), free: it.free, note: it.note || '',
      });
    }
    return out;
  }
  async function writeItems(st, orderIds, ids) {
    if (!orderIds.length) return 0;
    for (const part of chunk(orderIds, 100)) {
      const list = part.map(id => `"${id}"`).join(',');
      await C().raw(`/rest/v1/order_items?order_id=in.(${list})`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    }
    const want = new Set(orderIds);
    const lines = [];
    for (const o of st.orders) if (want.has(o.id)) (o.items || []).forEach((it, i) => lines.push({
      order_id: o.id, line_no: i + 1,
      service_id: it.svc && ids.services.has(it.svc) ? it.svc : null,
      subtype: s(it.subtype), qty: Number(it.qty) || 1, price: n(it.price),
      free: !!it.free, note: s(it.note),
    }));
    await upsert('order_items', lines, 'order_id,line_no');
    return lines.length;
  }
  // Fingerprint an order with its lines, so editing a line counts as a change.
  const fp = (t, r) => { const u = t.up(r); return u ? H(t.key === 'orders' ? [u, r.items || []] : u) : null; };

  // Send only rows that changed on this laptop since they last matched the cloud.
  let refusedCount = 0;
  let restore = [];
  async function pushChanged(b) {
    const st = S().get();
    const ids = {};
    for (const k of ['customers', 'orders', 'staff', 'services', 'expenseCategories', 'dispatch'])
      ids[k] = new Set((st[k] || []).map(r => r.id));
    let sent = 0;
    // Deletions first, children before parents.
    for (const t of [...TABLES].reverse()) {
      if (t.appendOnly) continue;
      const hb = b.h[t.table] = b.h[t.table] || {};
      const gone = Object.keys(hb).filter(id => !(st[t.key] || []).some(r => r.id === id));
      if (!gone.length) continue;
      const refused = [];
      for (const part of chunk(gone, 100)) {
        const list = part.map(id => `"${id}"`).join(',');
        let done = [];
        try {
          done = await C().raw(`/rest/v1/${t.table}?${t.pk}=in.(${list})`, { method: 'DELETE', headers: { 'Prefer': 'return=representation' } }) || [];
        } catch (e) { if (!/row-level security|permission denied|42501|403|23503/i.test(e.message)) throw new Error(`${t.table}: ${e.message}`); }
        const ok = new Set(done.map(r => String(r[t.pk])));
        for (const id of part) { delete hb[id]; if (!ok.has(id)) refused.push(id); }
      }
      // The cloud refused (till login cannot delete). Put the row back so both sides agree.
      if (refused.length) { restore.push({ t, ids: refused }); refusedCount += refused.length; }
      saveBase(b);
    }
    for (const t of TABLES) {
      const hb = b.h[t.table] = b.h[t.table] || {};
      const changed = (st[t.key] || []).filter(r => { const u = t.up(r); return u && hb[u[t.pk]] !== fp(t, r); });
      if (!changed.length) continue;
      const rows = clearDangling(t.table, changed.map(t.up), ids);
      try {
        if (t.appendOnly) await insertIgnore(t.table, rows, t.pk); else await upsert(t.table, rows, t.pk);
      } catch (e) {
        if (OWNER_ONLY.has(t.table) && /row-level security|permission denied|42501|403/i.test(e.message)) {
          changed.forEach(r => { hb[r.id] = fp(t, r); }); continue;
        }
        // One bad table must not stop the rest (approvals sit near the end of the list).
        pushErrors.push(`${t.table}: ${e.message}`); continue;
      }
      if (t.key === 'orders') await writeItems(st, changed.map(r => r.id), ids);
      changed.forEach(r => { hb[r.id] = fp(t, r); });
      sent += changed.length;
      saveBase(b);
    }
    for (const [table, x] of Object.entries(EXTRA)) {
      const hb = b.h[table] = b.h[table] || {};
      const changed = x.list(st).filter(r => hb[x.id(r)] !== H(r));
      if (!changed.length) continue;
      try { await upsert(table, changed, x.conflict); } catch (e) { pushErrors.push(`${table}: ${e.message}`); continue; }
      changed.forEach(r => { hb[x.id(r)] = H(r); });
      sent += changed.length;
      saveBase(b);
    }
    return sent;
  }

  // Download rows that changed in the cloud since last time and merge them in. A row
  // that also changed here (and has not been sent yet) is left alone; it goes up next.
  async function pullChanged(b) {
    const myGen = pullGen;
    const next = JSON.parse(S().snapshot());
    let got = 0;
    const pulledOrders = [];
    for (const t of TABLES) {
      const hb = b.h[t.table] = b.h[t.table] || {};
      const rows = await selectSince(t.table, b.cur[t.table], !!t.branch);
      if (!rows.length) continue;
      const list = next[t.key] = next[t.key] || [];
      const at = new Map(list.map((r, i) => [r.id, i]));
      for (const row of rows) {
        const d = t.down(row);
        const i = at.get(d.id);
        const local = i == null ? null : list[i];
        if (local && hb[d.id] !== fp(t, local)) continue;
        const merged = local ? { ...local, ...d } : d;
        if (i == null) { at.set(d.id, list.length); list.push(merged); } else list[i] = merged;
        if (t.key === 'orders') pulledOrders.push(d.id);
        else hb[d.id] = fp(t, merged);
        got++;
      }
      tick(b, t.table, rows);
    }
    if (pulledOrders.length) {
      const items = await itemsFor(pulledOrders);
      const ot = TABLES.find(t => t.key === 'orders');
      const hb = b.h.orders;
      for (const o of next.orders) if (pulledOrders.includes(o.id)) { o.items = items[o.id] || o.items || []; hb[o.id] = fp(ot, o); }
      next.orders.sort((a, z) => String(z.in).localeCompare(String(a.in)));
    }
    const st = S().get();
    for (const [table, x] of Object.entries(EXTRA)) {
      const hb = b.h[table] = b.h[table] || {};
      const rows = await selectSince(table, b.cur[table], true);
      if (!rows.length) continue;
      const localNow = new Map(x.list(st).map(r => [x.id(r), r]));
      for (const row of rows) {
        const k = x.id(row);
        const local = localNow.get(k);
        if (local && hb[k] !== H(local)) continue;
        if (table === 'settings') { next.settings = { ...(next.settings || {}), [k]: row.value }; hb[k] = H({ branch_id: BRANCH, key: k, value: row.value }); }
        if (table === 'sms_templates') { next.smsTemplates = { ...(next.smsTemplates || {}), [k]: row.body }; hb[k] = H({ branch_id: BRANCH, key: k, body: row.body }); }
        if (table === 'void_tags') {
          const v = { tag: row.tag, reason: row.reason, staff: row.staff_id, at: row.at };
          next.voidTags = [...(next.voidTags || []).filter(x => String(x.tag) !== k), v];
          hb[k] = H(EXTRA.void_tags.list({ voidTags: [v] })[0]);
        }
        got++;
      }
      tick(b, table, rows);
    }
    // Rows the cloud would not let this login delete come back.
    for (const { t, ids } of restore.splice(0)) {
      const hb = b.h[t.table] = b.h[t.table] || {};
      const list = next[t.key] = next[t.key] || [];
      for (const part of chunk(ids, 100)) {
        const rows = await C().raw(`/rest/v1/${t.table}?select=*&${t.pk}=in.(${part.map(id => `"${id}"`).join(',')})`, { method: 'GET' }) || [];
        const items = t.key === 'orders' ? await itemsFor(rows.map(r => r.id)) : {};
        for (const row of rows) {
          const d = t.down(row);
          if (t.key === 'orders') d.items = items[d.id] || [];
          if (!list.some(r => r.id === d.id)) list.push(d);
          hb[d.id] = fp(t, d);
          got++;
        }
      }
    }
    // Rows deleted on another laptop.
    let dels = [];
    try { dels = await selectSince('deleted_rows', b.cur.__deleted, false); }
    catch (e) { if (!/not exist|schema cache|404/i.test(e.message)) throw e; }
    for (const d of dels) {
      const t = TABLES.find(x => x.table === d.table_name);
      if (t) {
        if (t.branch && d.branch_id && d.branch_id !== BRANCH) continue;
        const hb = b.h[t.table] = b.h[t.table] || {};
        const list = next[t.key] || [];
        const i = list.findIndex(r => r.id === d.row_id);
        if (i < 0) { delete hb[d.row_id]; continue; }
        if (hb[d.row_id] !== fp(t, list[i])) continue; // edited here since; the edit wins
        list.splice(i, 1);
        delete hb[d.row_id];
        got++;
      } else if (EXTRA[d.table_name] && d.branch_id === BRANCH) {
        const hb = b.h[d.table_name] || {};
        if (d.table_name === 'settings' && next.settings) delete next.settings[d.row_id];
        if (d.table_name === 'sms_templates' && next.smsTemplates) delete next.smsTemplates[d.row_id];
        if (d.table_name === 'void_tags') next.voidTags = (next.voidTags || []).filter(v => String(v.tag) !== d.row_id);
        delete hb[d.row_id];
        got++;
      }
    }
    tick(b, '__deleted', dels);
    saveBase(b);
    // A full "Pull cloud" ran while this sync was in flight: our snapshot is stale and
    // would undo it. Skip; the next sync picks up anything still missing.
    if (myGen !== pullGen) return 0;
    if (got) S().importJSON(JSON.stringify(next));
    return got;
  }

  async function skipOldDeletions(b) {
    try { const r = await C().raw('/rest/v1/deleted_rows?select=updated_at&order=updated_at.desc&limit=1', { method: 'GET' }); tick(b, '__deleted', r || []); }
    catch (e) {}
  }
  function baselineAll(b) {
    const st = S().get();
    for (const t of TABLES) { const hb = b.h[t.table] = {}; for (const r of st[t.key] || []) { const u = t.up(r); if (u) hb[u[t.pk]] = fp(t, r); } }
    for (const [table, x] of Object.entries(EXTRA)) { const hb = b.h[table] = {}; for (const r of x.list(st)) hb[x.id(r)] = H(r); }
  }

  let pushErrors = [];
  let pullGen = 0;
  const API = {
    TABLES,
    isSetup() { return !!(loadBase() || {}).setup; },

    // Normal cycle: send what changed here, then fetch what changed elsewhere.
    async sync() {
      const b = loadBase();
      if (!b || !b.setup) throw new Error('Choose how this laptop joins two-way sync (Cloud & Updates)');
      refusedCount = 0;
      pushErrors = [];
      const sent = await pushChanged(b);
      // Always pull, even when part of the push failed, so requests from other tills arrive.
      const got = await pullChanged(b);
      C().setConfig({ lastSync: new Date().toISOString(), lastRefusedDeletes: refusedCount || 0, lastPushErrors: pushErrors.slice() });
      if (pushErrors.length) throw new Error('Some changes did not send. ' + pushErrors.join(' | '));
      return { sent, got, refused: refusedCount };
    },

    // First time on a laptop: its data is the truth. Send all of it, then take in
    // anything the cloud has that this laptop does not.
    async setupAsMaster() {
      const b = newBase();
      await skipOldDeletions(b);
      await API.push();
      baselineAll(b);
      saveBase(b);
      const got = await pullChanged(b);
      C().setConfig({ lastSync: new Date().toISOString() });
      return { got };
    },

    // First time on a laptop: the cloud is the truth. Replace local data with it.
    async setupFromCloud() {
      const b = newBase();
      await skipOldDeletions(b);
      await API.pull();
      for (const t of TABLES) { const r = await C().raw(`/rest/v1/${t.table}?select=updated_at&order=updated_at.desc&limit=1`, { method: 'GET' }); tick(b, t.table, r || []); }
      for (const table of Object.keys(EXTRA)) { const r = await C().raw(`/rest/v1/${table}?select=updated_at&branch_id=eq.${encodeURIComponent(BRANCH)}&order=updated_at.desc&limit=1`, { method: 'GET' }); tick(b, table, r || []); }
      baselineAll(b);
      saveBase(b);
      C().setConfig({ lastSync: new Date().toISOString() });
      return {};
    },

    branch() { return BRANCH; },
    setBranch(id) { BRANCH = id || 'main'; },

    // Confirm the schema is actually there before offering to sync against it.
    async checkSchema() {
      const missing = [];
      for (const t of [...TABLES.map(t => t.table), 'branches', 'order_items', 'order_statuses']) {
        try { await C().raw(`/rest/v1/${t}?select=1&limit=1`, { method: 'GET' }); }
        catch (e) { if (/not exist|schema cache|404/i.test(e.message)) missing.push(t); else throw e; }
      }
      return { ok: missing.length === 0, missing };
    },

    // ── push: local → cloud ───────────────────────────────────────────
    async push(onProgress) {
      const st = S().get();
      const report = [];
      const ids = {};
      for (const k of ['customers', 'orders', 'staff', 'services', 'expenseCategories', 'dispatch'])
        ids[k] = new Set((st[k] || []).map(r => r.id));

      for (const t of TABLES) {
        const rows = clearDangling(t.table, (st[t.key] || []).map(t.up).filter(Boolean), ids);
        onProgress && onProgress(t.table, rows.length);
        let written = 0;
        try {
          written = t.appendOnly
            ? await insertIgnore(t.table, rows, t.pk)
            : await upsert(t.table, rows, t.pk);
        } catch (e) {
          if (OWNER_ONLY.has(t.table) && /row-level security|permission denied|42501|403/i.test(e.message)) {
            report.push({ table: t.table, rows: 0, skipped: 'owner only' });
            continue;
          }
          throw new Error(`${t.table}: ${e.message}`);
        }
        report.push({ table: t.table, rows: written });

        // Order lines ride along with their orders: clear then rewrite, so a line
        // removed at the counter does not linger in the cloud.
        if (t.key === 'orders' && rows.length) {
          const orderIds = rows.map(r => r.id);
          for (const part of chunk(orderIds, 100)) {
            const list = part.map(id => `"${id}"`).join(',');
            await C().raw(`/rest/v1/order_items?order_id=in.(${list})`, {
              method: 'DELETE', headers: { 'Prefer': 'return=minimal' },
            });
          }
          const lines = [];
          for (const o of st.orders) {
            (o.items || []).forEach((it, i) => lines.push({
              order_id: o.id, line_no: i + 1,
              service_id: it.svc && ids.services.has(it.svc) ? it.svc : null,
              subtype: s(it.subtype), qty: Number(it.qty) || 1, price: n(it.price),
              free: !!it.free, note: s(it.note),
            }));
          }
          await upsert('order_items', lines, 'order_id,line_no');
          report.push({ table: 'order_items', rows: lines.length });
        }
      }

      // Settings and templates are key/value, not a collection.
      const settings = Object.entries(st.settings || {}).map(([key, value]) =>
        ({ branch_id: BRANCH, key, value }));
      await upsert('settings', settings, 'branch_id,key');
      const templates = Object.entries(st.smsTemplates || {}).map(([key, body]) =>
        ({ branch_id: BRANCH, key, body }));
      await upsert('sms_templates', templates, 'branch_id,key');

      const tags = (st.voidTags || []).map(v => ({
        branch_id: BRANCH, tag: String(v.tag), reason: s(v.reason), staff_id: s(v.staff), at: ts(v.at),
      }));
      await upsert('void_tags', tags, 'branch_id,tag');

      C().setConfig({ lastSync: new Date().toISOString() });
      return report;
    },

    // ── pull: cloud → local ───────────────────────────────────────────
    // Replaces the local collections outright. The caller confirms first — this is
    // "the cloud is right, make this laptop match", not a merge.
    async pull(onProgress) {
      pullGen++;
      const next = JSON.parse(S().snapshot());
      for (const t of TABLES) {
        onProgress && onProgress(t.table);
        const rows = await selectAll(t.table);
        next[t.key] = rows.map(t.down);
      }
      const items = await selectAll('order_items', 'order_id,line_no');
      const byOrder = {};
      for (const it of items) {
        (byOrder[it.order_id] = byOrder[it.order_id] || []).push({
          svc: it.service_id, subtype: it.subtype || '', qty: Number(it.qty),
          price: Number(it.price), free: it.free, note: it.note || '',
        });
      }
      next.orders = (next.orders || []).map(o => ({ ...o, items: byOrder[o.id] || [] }))
        .sort((a, b) => String(b.in).localeCompare(String(a.in)));

      const settings = await selectAll('settings');
      next.settings = { ...(next.settings || {}) };
      for (const r of settings.filter(r => r.branch_id === BRANCH)) next.settings[r.key] = r.value;

      const templates = await selectAll('sms_templates');
      next.smsTemplates = { ...(next.smsTemplates || {}) };
      for (const r of templates.filter(r => r.branch_id === BRANCH)) next.smsTemplates[r.key] = r.body;

      const tags = await selectAll('void_tags');
      next.voidTags = tags.filter(r => r.branch_id === BRANCH)
        .map(r => ({ tag: r.tag, reason: r.reason, staff: r.staff_id, at: r.at }));

      pullGen++;
      const ok = S().importJSON(JSON.stringify(next));
      // This laptop now matches the cloud: record that, so the next sync neither
      // re-sends every row nor skips cloud rows as "changed here".
      const b = loadBase();
      if (b) {
        const now = S().get();
        for (const t of TABLES) {
          const hb = b.h[t.table] = {};
          for (const r of (now[t.key] || [])) hb[r.id] = fp(t, r);
        }
        saveBase(b);
      }
      return ok;
    },

    // Row counts on both sides, so the owner can see at a glance whether the
    // cloud is behind before trusting it.
    async compare() {
      const st = S().get();
      const out = [];
      for (const t of TABLES) {
        let cloud = null, error = '';
        try {
          const res = await C().rawResponse(`/rest/v1/${t.table}?select=id`, {
            method: 'HEAD', headers: { 'Prefer': 'count=exact', Range: '0-0' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const cr = res.headers.get('content-range');
          // No count header means the browser was not allowed to read it, not that
          // the table is empty — say so rather than showing a dash.
          if (!cr) throw new Error('count header not returned');
          cloud = Number(String(cr).split('/')[1]);
          if (!Number.isFinite(cloud)) throw new Error(`unreadable count "${cr}"`);
        } catch (e) { cloud = null; error = e.message || String(e); }
        out.push({ table: t.table, label: t.key, local: (st[t.key] || []).length, cloud, error });
      }
      return out;
    },
  };

  window.SAFI_SYNC = API;
})();
