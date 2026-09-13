// Vazi Safi — integrity scan
//
// Reads the books and reports what does not add up. Detection only: it writes nothing
// and shows nothing to the front desk. The premise is that an attendant who intends to
// pocket an order has to leave at least one of these traces, and leaving none of them
// is more work than doing the job honestly.
//
// window.SAFI_INTEGRITY.scan({ from, to }) -> { flags, staff, totals }

window.SAFI_INTEGRITY = (() => {
  const iso = (d) => d.toISOString().slice(0, 10);
  const toIso = (s) => String(s || '').replace(' ', 'T');

  function range(days) {
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 864e5);
    return { from: iso(from), to: iso(to) };
  }

  function scan(opts = {}) {
    const D = window.SAFI_STORE.get();
    const { from, to } = opts.from ? opts : range(opts.days || 30);
    const inRange = (dateStr) => {
      const d = String(dateStr || '').slice(0, 10);
      return d >= from && d <= to;
    };

    const orders   = (D.orders || []).filter(o => inRange(o.in));
    const payments = (D.payments || []).filter(p => inRange(p.date));
    const messages = (D.messages || []);
    const audit    = (D.auditLog || []).filter(a => inRange(a.at));
    const shifts   = (D.shifts || []).filter(s => inRange(s.openedAt));
    const staff    = D.staff || [];
    const limit    = D.settings?.varianceLimit ?? 100;

    const staffName = (id) => staff.find(s => s.id === id)?.name || (id ? 'Unknown' : '—');
    const flags = [];
    const push = (sev, kind, title, detail, rows) =>
      flags.push({ sev, kind, title, detail, count: rows ? rows.length : 1, rows: rows || [] });

    // ── 1. No customer SMS on intake ───────────────────────────────────────
    // The strongest control: if the customer got a text naming the order, the order
    // cannot be off the books. An order with no intake SMS is one the customer has no
    // independent record of.
    const smsOrderIds = new Set(messages.filter(m => m.stage === 'intake').map(m => m.orderId));
    const noSms = orders.filter(o => !smsOrderIds.has(o.id));
    if (noSms.length) {
      push(noSms.length > 3 ? 'high' : 'med', 'no-sms', 'Orders with no customer SMS',
        'The customer holds no independent record of these orders. Ask why each one was skipped.',
        noSms.map(o => ({ order: o.id, at: o.in, staff: staffName(o.cashier), amount: o.total })));
    }

    // ── 2. Tag-book gaps and reuse ─────────────────────────────────────────
    const tagged = orders.filter(o => o.tag).map(o => ({ ...o, tagN: parseInt(String(o.tag).replace(/\D/g, ''), 10) }))
      .filter(o => !isNaN(o.tagN));
    const voided = new Set((D.voidTags || []).map(v => parseInt(String(v.tag).replace(/\D/g, ''), 10)));
    if (tagged.length > 1) {
      const nums = tagged.map(o => o.tagN).sort((a, b) => a - b);
      const gaps = [];
      for (let n = nums[0]; n < nums[nums.length - 1]; n++) {
        if (!nums.includes(n) && !voided.has(n)) gaps.push(n);
      }
      if (gaps.length) {
        push(gaps.length > 5 ? 'high' : 'med', 'tag-gap', 'Missing tag numbers',
          `Tags issued between ${nums[0]} and ${nums[nums.length - 1]}, but these were never entered against an order and were not declared void.`,
          gaps.slice(0, 60).map(n => ({ tag: n })));
      }
      const seen = new Map();
      const dupes = [];
      for (const o of tagged) {
        if (seen.has(o.tagN)) dupes.push({ tag: o.tagN, order: o.id, other: seen.get(o.tagN) });
        else seen.set(o.tagN, o.id);
      }
      if (dupes.length) {
        push('high', 'tag-dupe', 'Tag numbers used twice',
          'One physical tag cannot be on two orders. Usually means a number was invented rather than read off the book.', dupes);
      }
    }
    const untagged = orders.filter(o => !o.tag);
    if (D.settings?.requireTag && untagged.length) {
      push('low', 'no-tag', 'Orders with no tag number',
        'These cannot be reconciled against the tag book.',
        untagged.map(o => ({ order: o.id, at: o.in, staff: staffName(o.cashier) })));
    }

    // ── 3. M-Pesa codes: missing, or reused ────────────────────────────────
    const electronic = payments.filter(p => p.method && p.method !== 'cash' && p.method !== '—');
    const noCode = electronic.filter(p => !p.txn);
    if (noCode.length) {
      push('high', 'no-txn', 'M-Pesa or bank payments with no confirmation code',
        'Without a code there is nothing to match against the business statement — the money may never have arrived.',
        noCode.map(p => ({ order: p.order, at: p.date, method: p.method, amount: p.amount, staff: staffName(p.staff) })));
    }
    const codes = new Map();
    const reused = [];
    for (const p of electronic.filter(p => p.txn)) {
      const k = String(p.txn).trim().toUpperCase();
      if (codes.has(k)) reused.push({ txn: k, order: p.order, other: codes.get(k), amount: p.amount });
      else codes.set(k, p.order);
    }
    if (reused.length) {
      push('high', 'txn-reuse', 'The same M-Pesa code on more than one order',
        'A confirmation code is unique to one transaction. Reuse means one real payment was recorded against two orders.', reused);
    }

    // ── 4. Cash variance at shift close ────────────────────────────────────
    const closed = shifts.filter(s => s.closedAt);
    const short = closed.filter(s => Math.abs(s.variance || 0) > limit);
    if (short.length) {
      push(short.some(s => (s.variance || 0) < -limit * 3) ? 'high' : 'med', 'variance', 'Cash did not balance at shift close',
        `Declared cash differed from what the orders say should have been in the drawer, by more than ${limit}.`,
        short.map(s => ({ staff: staffName(s.staff), at: s.closedAtLabel || s.closedAt,
          expected: s.expectedCash, declared: s.declaredCash, variance: s.variance })));
    }
    const neverClosed = shifts.filter(s => !s.closedAt && (Date.now() - new Date(s.openedAt).getTime()) > 20 * 3600e3);
    if (neverClosed.length) {
      push('med', 'shift-open', 'Shifts left open',
        'An unclosed shift never gets a cash count, so nothing can be checked against it.',
        neverClosed.map(s => ({ staff: staffName(s.staff), at: s.openedAtLabel || s.openedAt })));
    }

    // ── 5. Goods handed over with money still owing ────────────────────────
    const releasedUnpaid = (D.releases || []).filter(r => inRange(r.at) && r.balanceAtRelease > 0);
    if (releasedUnpaid.length) {
      push('high', 'released-unpaid', 'Clothes released with a balance outstanding',
        'The garments left the shop but the system was never paid. The customer very likely did pay.',
        releasedUnpaid.map(r => ({ order: r.order, at: r.atLabel || r.at, staff: staffName(r.staff), balance: r.balanceAtRelease })));
    }
    const collectedOwing = orders.filter(o => o.status === 'collected' && (o.total - (o.paid || 0)) > 0);
    if (collectedOwing.length) {
      push('high', 'collected-owing', 'Collected orders still showing a balance',
        'Either the payment was never entered, or it was taken elsewhere.',
        collectedOwing.map(o => ({ order: o.id, at: o.in, staff: staffName(o.cashier), balance: o.total - (o.paid || 0) })));
    }

    // ── 5b. Rider cards ────────────────────────────────────────────────────
    const cards = (D.deliveryCards || []).filter(c => inRange(c.issuedAt));
    const staleCards = cards.filter(c => !c.returnedAt && c.rider &&
      (Date.now() - new Date(c.issuedAt).getTime()) > 36 * 3600e3);
    if (staleCards.length) {
      push('high', 'card-out', 'Delivery notes not brought back',
        'Each of these is a delivery whose money nobody has accounted for. Hold the rider\'s pay until the note is surrendered.',
        staleCards.map(c => ({ tag: c.serial, order: c.order, at: c.issuedAtLabel,
          staff: staffName(c.rider), amount: c.amountDue })));
    }
    const shortCards = cards.filter(c => c.returnedAt && (c.receivedAmount || 0) < (c.amountDue || 0));
    if (shortCards.length) {
      push('high', 'card-short', 'Notes returned with less money than the note says',
        'The note stated an amount to collect and less came back.',
        shortCards.map(c => ({ tag: c.serial, order: c.order, at: c.returnedAtLabel,
          staff: staffName(c.rider), expected: c.amountDue, declared: c.receivedAmount,
          variance: (c.receivedAmount || 0) - (c.amountDue || 0) })));
    }
    const noCardDeliveries = (D.dispatch || []).filter(d => d.type === 'delivery'
      && d.status === 'completed' && !(D.deliveryCards || []).some(c => c.order === d.orderId));
    if (noCardDeliveries.length) {
      push('med', 'no-card', 'Deliveries completed with no delivery note issued',
        'A delivery with no numbered note leaves no document to surrender, so nothing to reconcile against.',
        noCardDeliveries.map(d => ({ order: d.orderId || '—', staff: staffName(d.rider) })));
    }

    // ── 6. Deletions and late edits ────────────────────────────────────────
    const deletions = audit.filter(a => a.action === 'order.delete');
    if (deletions.length) {
      push('high', 'deleted', 'Orders deleted',
        'The commonest way to erase a sale. Every deletion should have a reason you already know about.',
        deletions.map(a => ({ order: a.target, at: a.at.slice(0, 16).replace('T', ' '), staff: staffName(a.staff), detail: a.detail })));
    }
    const lateEdits = audit.filter(a => a.action === 'order.edit' && a.meta?.afterCollection);
    if (lateEdits.length) {
      push('med', 'late-edit', 'Orders edited after collection',
        'A finished order should not need changing. Amount changes here are worth reading closely.',
        lateEdits.map(a => ({ order: a.target, at: a.at.slice(0, 16).replace('T', ' '), staff: staffName(a.staff), detail: a.detail })));
    }
    const voids = (D.voidTags || []).filter(v => inRange(v.at));
    if (voids.length > 5) {
      push('med', 'many-voids', 'Unusual number of voided tags',
        'Voiding is the quiet way to explain away a missing tag. A rising count deserves a question.',
        voids.map(v => ({ tag: v.tag, at: String(v.at).slice(0, 16).replace('T', ' '), staff: staffName(v.staff), reason: v.reason })));
    }

    // ── 7. Discounts and free items ────────────────────────────────────────
    const bigDiscount = orders.filter(o => (o.discountPct || 0) >= 25);
    if (bigDiscount.length) {
      push('low', 'discount', 'Large discounts given',
        'A discount is cash that never enters the drawer and needs no code.',
        bigDiscount.map(o => ({ order: o.id, at: o.in, staff: staffName(o.cashier), pct: o.discountPct, off: o.discount })));
    }

    // ── Per-attendant summary ──────────────────────────────────────────────
    const byStaff = staff.map(s => {
      const mine = orders.filter(o => o.cashier === s.id);
      const myShifts = closed.filter(x => x.staff === s.id);
      const varianceTotal = myShifts.reduce((n, x) => n + (x.variance || 0), 0);
      const mySms = mine.filter(o => smsOrderIds.has(o.id)).length;
      const myDeletes = deletions.filter(a => a.staff === s.id).length;
      const myNoCode = noCode.filter(p => {
        const o = orders.find(x => x.id === p.order);
        return o && o.cashier === s.id;
      }).length;
      const smsRate = mine.length ? Math.round((mySms / mine.length) * 100) : null;

      // Simple additive risk: each signal is independently suspicious, so they stack.
      let risk = 0;
      if (smsRate !== null && smsRate < 95) risk += (95 - smsRate) * 0.6;
      risk += myDeletes * 12;
      risk += myNoCode * 8;
      risk += Math.min(40, Math.abs(varianceTotal) / Math.max(1, limit) * 8);
      risk += mine.filter(o => !o.tag).length * 3;

      return {
        id: s.id, name: s.name, orders: mine.length,
        revenue: mine.reduce((n, o) => n + (o.total || 0), 0),
        smsRate, deletes: myDeletes, noCode: myNoCode,
        shifts: myShifts.length, varianceTotal,
        risk: Math.min(100, Math.round(risk)),
      };
    }).filter(s => s.orders || s.shifts).sort((a, b) => b.risk - a.risk);

    const sevRank = { high: 0, med: 1, low: 2 };
    flags.sort((a, b) => sevRank[a.sev] - sevRank[b.sev]);

    return {
      from, to, flags, staff: byStaff,
      totals: {
        orders: orders.length,
        smsCoverage: orders.length ? Math.round((orders.filter(o => smsOrderIds.has(o.id)).length / orders.length) * 100) : null,
        tagged: orders.length ? Math.round((orders.filter(o => o.tag).length / orders.length) * 100) : null,
        high: flags.filter(f => f.sev === 'high').length,
        med: flags.filter(f => f.sev === 'med').length,
        low: flags.filter(f => f.sev === 'low').length,
      },
    };
  }

  return { scan, range };
})();
