// Vazi Safi — job card + delivery note
//
// One A4 sheet, tear line across the middle:
//
//   TOP  — job card. Stays with the garments through the shop. Order number, client
//          number for the day, tag, item list with a blank notes column, stage sign-off
//          boxes, and a DUE BACK line filled in by hand.
//   FOOT — delivery note. Leaves with the rider, comes back to the office. Same serial
//          (order number + client number), the amount to collect, and hand-written fields
//          for what was actually received. Rider pay settles against returned notes.
const { useState: useStateDC, useMemo: useMemoDC } = React;

const STAGES_JC = ['Washing', 'Drying', 'Ironing', 'Folding', 'Ready', 'Delivery'];
const nowStamp = () => new Date().toLocaleString('en-KE', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const clientNo = (o) => o.queueNo ? String(o.queueNo).padStart(2, '0') : '—';

// ─── Job card (top half) ──────────────────────────────────────────────────
function JobCard({ order, card, D, shop }) {
  const c = D.customers.find(x => x.id === order.customer);
  const svcName = (id) => D.services.find(s => s.id === id)?.name || id;
  const rider = D.staff.find(s => s.id === card?.rider);

  return (
    <section className="safi-jc">
      <header className="safi-jc__hd">
        <div>
          <div className="safi-jc__shop">{shop?.name || 'VAZI SAFI LAUNDRY'}</div>
          <div className="safi-jc__kind">Job card — stays with the garments</div>
        </div>
        <div className="safi-jc__ids">
          <div><span>Order no. · client no.</span><b className="safi-mono">{card?.serial || order.id}</b></div>
          <div><span>Tag no.</span><b className="safi-mono">{order.tag || '—'}</b></div>
        </div>
      </header>

      <div className="safi-jc__row">
        <div className="safi-jc__f safi-jc__f--wide">
          <span>Customer</span>
          <b>{c?.name || 'Walk-in customer'}</b>
        </div>
        <div className="safi-jc__f"><span>Client no. today</span><b className="safi-mono">{clientNo(order)}</b></div>
        <div className="safi-jc__f"><span>Phone</span><b className="safi-mono">{c ? `${c.prefix || ''} ${c.phone}` : '—'}</b></div>
      </div>
      <div className="safi-jc__row">
        <div className="safi-jc__f"><span>Taken in</span><b>{order.in}</b></div>
        <div className="safi-jc__f safi-jc__f--fill"><span>Due back</span><i/></div>
        <div className="safi-jc__f"><span>Attendant</span><b>{(D.staff.find(s => s.id === order.cashier) || {}).name || '—'}</b></div>
        <div className="safi-jc__f"><span>Total</span><b className="safi-mono">KES {Math.round(order.total).toLocaleString('en-KE')}</b></div>
      </div>

      <table className="safi-jc__items">
        <thead><tr><th>Item</th><th>Qty</th><th>Notes</th></tr></thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={i}>
              <td>{it.subtype || svcName(it.svc)}{it.free ? ' (free)' : ''}</td>
              <td className="safi-mono">{it.qty}</td>
              <td className="safi-jc__blank"/>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="safi-jc__stages">
        <div className="safi-jc__stages-t">Sign off each stage</div>
        <div className="safi-jc__stages-grid">
          {STAGES_JC.map(s => (
            <div key={s}><span>{s}</span><i/></div>
          ))}
        </div>
      </div>

      {order.notes && <div className="safi-jc__note"><span>Special instructions</span>{order.notes}</div>}

      <footer className="safi-jc__ft">
        <span>{rider ? `For delivery by ${rider.name}.` : 'For collection at the shop.'}</span>
        <span>Printed {nowStamp()}</span>
      </footer>
    </section>
  );
}

// ─── Delivery note (bottom half) ──────────────────────────────────────────
function DeliveryNote({ order, card, D, shop }) {
  const c = D.customers.find(x => x.id === order.customer);
  const d = card?.dispatch ? D.dispatch.find(x => x.id === card.dispatch) : null;
  const rider = D.staff.find(s => s.id === card?.rider);
  const payTo = D.settings?.payTo || '';
  const due = card ? card.amountDue : Math.max(0, (order.total || 0) - (order.paid || 0));

  return (
    <section className="safi-dn">
      <header className="safi-dn__hd">
        <div>
          <div className="safi-dn__shop">{shop?.name || 'VAZI SAFI LAUNDRY'}</div>
          <div className="safi-dn__kind">Delivery note — rider returns this to the office</div>
        </div>
        <div className="safi-dn__serial">
          <span>Note no.</span>
          <b>{card?.serial || order.id}</b>
        </div>
      </header>

      <div className="safi-dn__grid">
        <div><span>Order / receipt</span><b className="safi-mono">{order.id}</b></div>
        <div><span>Client no. today</span><b className="safi-mono">{clientNo(order)}</b></div>
        <div><span>Tag no.</span><b className="safi-mono">{order.tag || '—'}</b></div>
        <div><span>Rider</span><b>{rider?.name || '—'}</b></div>
      </div>

      <div className="safi-dn__cust">
        <div className="safi-dn__cust-name">{c?.name || 'Walk-in customer'}</div>
        <div className="safi-mono">{c ? `${c.prefix || ''} ${c.phone}` : ''}</div>
        <div>{d?.address || c?.residence || '—'}{d?.area ? ` · ${d.area}` : ''}</div>
        {d?.slotStart && <div className="safi-dn__slot">Slot {d.slotStart} – {d.slotEnd}</div>}
      </div>

      {due > 0 ? (
        <div className="safi-dn__due">
          <span>COLLECT ON DELIVERY</span>
          <b className="safi-mono">KES {Math.round(due).toLocaleString('en-KE')}</b>
        </div>
      ) : (
        <div className="safi-dn__due safi-dn__due--paid">
          <span>ALREADY PAID IN FULL</span>
          <b>COLLECT NOTHING</b>
        </div>
      )}

      {payTo && (
        <div className="safi-dn__payto">
          M-Pesa goes to <b className="safi-mono">{payTo}</b>{D.settings?.payToName ? ` · ${D.settings.payToName}` : ''} only. Never to a personal number.
        </div>
      )}

      <div className="safi-dn__fill">
        <div className="safi-dn__fill-t">Rider completes on delivery</div>
        <div className="safi-dn__fill-grid">
          <label>Amount received<i/></label>
          <label>Cash / M-Pesa<i/></label>
          <label>M-Pesa code<i/></label>
          <label>Date &amp; time delivered<i/></label>
          <label className="safi-dn__fill-wide">Received by — name &amp; signature<i/></label>
        </div>
      </div>

      <footer className="safi-dn__ft">
        <span>Surrender this note to the office on return. Rider payment is made against returned notes only.
        {D.settings?.ownerPhone ? ` Queries: ${D.settings.ownerPhone}.` : ''}</span>
        <span>Printed {nowStamp()}</span>
      </footer>
    </section>
  );
}

// ─── The printable sheet ──────────────────────────────────────────────────
function JobCardSheet({ orderId, setView, shop, lang }) {
  const D = useStore();
  const order = D.orders.find(o => o.id === orderId) || D.orders[0];
  if (!order) return <Topbar title="Job card" subtitle="No order selected."/>;

  const card = window.SAFI_STORE.getCardForOrder(order.id)
    || window.SAFI_STORE.issueDeliveryCard(order.id);

  return (
    <>
      <Topbar
        title="Job card & delivery note"
        subtitle="One A4 sheet, tear along the dashed line. Job card stays with the garments, delivery note goes with the rider."
        right={<>
          <Button kind="ghost" onClick={() => setView('receipt')}>← Receipt</Button>
          <Button kind="ghost" onClick={() => setView('order-detail')}>Order</Button>
          <Button kind="primary" icon="print" onClick={() => window.print()}>Print</Button>
        </>}
      />
      <div className="safi-jcsheet" id="safi-print-area">
        <JobCard order={order} card={card} D={D} shop={shop}/>
        <div className="safi-tear"><span>tear here</span></div>
        <DeliveryNote order={order} card={card} D={D} shop={shop}/>
      </div>
    </>
  );
}

// ─── Settlement (Management) ──────────────────────────────────────────────
function RiderCardsScreen({ setView, setActiveOrderId, money }) {
  const D = useStore();
  const [tab, setTab] = useStateDC('out');
  const [settle, setSettle] = useStateDC(null);
  const [amt, setAmt] = useStateDC('');
  const [pm, setPm] = useStateDC('cash');
  const [txn, setTxn] = useStateDC('');
  const [note, setNote] = useStateDC('');

  const cards = D.deliveryCards || [];
  // A note is only rider exposure once a rider has it. Every other note is a counter
  // collection — still part of the serial sequence, but nobody's money is out.
  const out = cards.filter(c => c.rider && !c.returnedAt);
  const shop = cards.filter(c => !c.rider && !c.returnedAt);
  const back = cards.filter(c => c.returnedAt);
  const staffName = (id) => D.staff.find(s => s.id === id)?.name || '—';
  const custName = (id) => D.customers.find(c => c.id === id)?.name || 'Walk-in';

  const byRider = useMemoDC(() => {
    const riders = [...new Set(cards.map(c => c.rider).filter(Boolean))];
    return riders.map(r => {
      const mine = cards.filter(c => c.rider === r);
      const mineOut = mine.filter(c => !c.returnedAt);
      const mineBack = mine.filter(c => c.returnedAt);
      const due = mineBack.reduce((n, c) => n + (c.amountDue || 0), 0);
      const got = mineBack.reduce((n, c) => n + (c.receivedAmount || 0), 0);
      return {
        rider: r, name: staffName(r),
        issued: mine.length, outstanding: mineOut.length,
        outstandingValue: mineOut.reduce((n, c) => n + (c.amountDue || 0), 0),
        due, got, short: due - got,
      };
    }).sort((a, b) => b.outstanding - a.outstanding);
  }, [cards, D.staff]);

  function openSettle(card) {
    setSettle(card);
    setAmt(String(card.amountDue || 0));
    setPm('cash'); setTxn(''); setNote('');
  }
  const openSheet = (orderId) => { setActiveOrderId(orderId); setView('job-card'); };

  return (
    <>
      <Topbar
        title="Rider notes"
        subtitle="Every job sheet carries a numbered delivery note. Pay a rider only against the notes they bring back."
      />

      <div className="safi-stat-row">
        <StatCard label="Notes out with riders" value={out.length} icon="truck"/>
        <StatCard label="Value out" value={money(out.reduce((n, c) => n + (c.amountDue || 0), 0))} icon="wallet"/>
        <StatCard label="Returned short" value={back.filter(c => (c.receivedAmount || 0) < (c.amountDue || 0)).length} icon="alert"/>
        <StatCard label="Next note number" value={window.SAFI_STORE.nextCardSerial()} icon="tag"/>
      </div>

      <Card title="Rider settlement position" pad={false}>
        <Table
          cols={[
            { label: 'Rider', render: r => <b>{r.name}</b> },
            { label: 'Notes issued', render: r => r.issued },
            { label: 'Not returned', render: r => r.outstanding
              ? <span className="safi-neg"><b>{r.outstanding}</b></span> : '—' },
            { label: 'Value still out', render: r => <span className="safi-mono">{money(r.outstandingValue)}</span> },
            { label: 'Collected on returned notes', render: r => <span className="safi-mono">{money(r.got)}</span> },
            { label: 'Short', render: r => r.short > 0
              ? <span className="safi-mono safi-neg">{money(r.short)}</span>
              : <span className="safi-mono">{money(0)}</span> },
            { label: 'Clear to pay?', render: r => r.outstanding === 0 && r.short <= 0
              ? <span className="safi-pill safi-pill--green">Yes</span>
              : <span className="safi-pill safi-pill--red">Hold</span> },
          ]}
          rows={byRider}
          empty="No notes issued to a rider yet."
        />
      </Card>

      <div className="safi-tabs">
        {[['out', `Out with riders (${out.length})`], ['shop', `Counter collection (${shop.length})`], ['back', `Returned (${back.length})`]].map(([k, l]) => (
          <button key={k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'out' && (
        <Card title="Notes out" pad={false}>
          <Table
            cols={[
              { label: 'Note no.', render: r => <b className="safi-mono">{r.serial}</b> },
              { label: 'Order', render: r => <span className="safi-mono">{r.order || '—'}</span> },
              { label: 'Customer', render: r => custName(r.customer) },
              { label: 'Rider', render: r => staffName(r.rider) },
              { label: 'Issued', render: r => r.issuedAtLabel },
              { label: 'To collect', render: r => <span className="safi-mono">{money(r.amountDue)}</span> },
              { label: '', render: r => (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="safi-rowlink" onClick={() => openSheet(r.order)}>Reprint</button>
                  <button className="safi-rowlink" onClick={() => openSettle(r)}>Note returned</button>
                </div>
              )},
            ]}
            rows={out}
            empty="No notes are out with riders."
          />
        </Card>
      )}

      {tab === 'shop' && (
        <Card title="Notes issued for counter collection"
          action={<span className="safi-hint">No rider assigned — no money out. Listed so the serial sequence stays complete.</span>}
          pad={false}>
          <Table
            cols={[
              { label: 'Note no.', render: r => <b className="safi-mono">{r.serial}</b> },
              { label: 'Order', render: r => <span className="safi-mono">{r.order || '—'}</span> },
              { label: 'Customer', render: r => custName(r.customer) },
              { label: 'Issued', render: r => r.issuedAtLabel },
              { label: 'Balance on order', render: r => <span className="safi-mono">{money(r.amountDue)}</span> },
              { label: '', render: r => (
                <button className="safi-rowlink" onClick={() => openSheet(r.order)}>Reprint</button>
              )},
            ]}
            rows={shop}
            empty="None."
          />
        </Card>
      )}

      {tab === 'back' && (
        <Card title="Returned notes" pad={false}>
          <Table
            cols={[
              { label: 'Note no.', render: r => <b className="safi-mono">{r.serial}</b> },
              { label: 'Order', render: r => <span className="safi-mono">{r.order || '—'}</span> },
              { label: 'Rider', render: r => staffName(r.rider) },
              { label: 'Returned', render: r => r.returnedAtLabel },
              { label: 'Due', render: r => <span className="safi-mono">{money(r.amountDue)}</span> },
              { label: 'Received', render: r => <span className="safi-mono">{money(r.receivedAmount)}</span> },
              { label: 'Method', render: r => r.receivedMethod ? <MethodBadge method={r.receivedMethod}/> : '—' },
              { label: 'Code', render: r => <span className="safi-mono">{r.receivedTxn || '—'}</span> },
              { label: 'Difference', render: r => {
                const diff = (r.receivedAmount || 0) - (r.amountDue || 0);
                return diff === 0 ? <span className="safi-mono">—</span>
                  : <span className={`safi-mono ${diff < 0 ? 'safi-neg' : 'safi-pos'}`}>{diff > 0 ? '+' : ''}{money(diff)}</span>;
              }},
            ]}
            rows={back}
            empty="No notes have come back yet."
          />
        </Card>
      )}

      <Modal open={!!settle} onClose={() => setSettle(null)} width={420}
        title={settle ? `Note ${settle.serial} returned` : ''}
        footer={<>
          <Button kind="ghost" onClick={() => setSettle(null)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={() => {
            window.SAFI_STORE.returnDeliveryCard(settle.id, {
              receivedAmount: Number(amt) || 0, receivedMethod: pm, receivedTxn: txn, note,
            });
            toast(`Note ${settle.serial} logged as returned`, 'success');
            setSettle(null);
          }}>Log return</Button>
        </>}>
        {settle && (
          <div className="safi-form">
            <div className="safi-mini-cust__row"><span>Order</span><b className="safi-mono">{settle.order || '—'}</b></div>
            <div className="safi-mini-cust__row"><span>Customer</span><b>{custName(settle.customer)}</b></div>
            <div className="safi-mini-cust__row"><span>Amount on the note</span><b className="safi-mono">{money(settle.amountDue)}</b></div>
            <label>Amount actually received
              <input className="safi-input safi-mono" inputMode="numeric" value={amt} autoFocus
                onChange={e => setAmt(e.target.value.replace(/[^\d]/g, ''))}/>
            </label>
            <label>How it was paid
              <select className="safi-input" value={pm} onChange={e => setPm(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank</option>
              </select>
            </label>
            {pm !== 'cash' && (
              <label>Confirmation code as written on the note
                <input className="safi-input safi-mono" value={txn} onChange={e => setTxn(e.target.value.toUpperCase())}
                  placeholder="e.g. SGH7X2K9QP"/>
              </label>
            )}
            <label>Note (optional)
              <input className="safi-input" value={note} onChange={e => setNote(e.target.value)}
                placeholder="Anything the rider explained"/>
            </label>
            {Number(amt) !== settle.amountDue && (
              <p className="safi-hint safi-neg">
                Differs from the {money(settle.amountDue)} on the note by {money(Math.abs(Number(amt) - settle.amountDue))}.
                The difference is logged against the rider.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

Object.assign(window, { RiderCardsScreen, JobCardSheet, JobCard, DeliveryNote });
