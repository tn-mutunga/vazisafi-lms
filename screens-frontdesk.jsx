// Vazi Safi — Front Desk screens (live-data version, backed by SAFI_STORE)
const { useState: useStateFD, useMemo: useMemoFD, useEffect: useEffectFD, useRef: useRefFD } = React;

// ─── Front Desk Dashboard ─────────────────────────────────────────────────
function FrontDeskDashboard({ setView, setActiveOrderId, lang, money }) {
  const D = useStore();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = D.orders.filter(o => o.in.startsWith(todayStr));
  const revenueToday = todayOrders.reduce((s, o) => s + (o.paid || 0), 0);
  const pending = D.orders.filter(o => o.status === 'ready').length;
  const washing = D.orders.filter(o => o.status === 'washing').length;
  const ironing = D.orders.filter(o => o.status === 'ironing').length;

  const queue = D.orders.filter(o => o.status !== 'collected').slice(0, 6);

  const openShift = window.SAFI_STORE.getOpenShift();
  const [shiftModal, setShiftModal] = useStateFD(false);

  return (
    <>
      <Topbar
        title={`${t('today', lang)} · ${new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        subtitle="Karibu Vazi Safi 👋 — here is what's happening at the shop right now."
        right={<>
          <Button kind="ghost" icon="search">Search</Button>
          <Button kind={openShift ? 'ghost' : 'secondary'} icon="clock" onClick={() => setShiftModal(true)}>
            {openShift ? 'Close shift' : 'Open shift'}
          </Button>
          <Button kind="primary" icon="plus" onClick={() => setView('new-order')}>{t('new_order', lang)}</Button>
        </>}
      />

      <ShiftModal open={shiftModal} onClose={() => setShiftModal(false)} money={money}/>

      <div className="safi-grid safi-grid--4">
        <StatCard label={t('orders_today', lang)} value={todayOrders.length} icon="list" sparkline={<Sparkline data={D.revenueTrend.slice(-7)} width={140} height={32}/>}/>
        <StatCard label={t('revenue_today', lang)} value={money(revenueToday)} icon="wallet" sparkline={<Sparkline data={D.revenueTrend.slice(-7)} width={140} height={32}/>}/>
        <StatCard label={t('pending_collection', lang)} value={pending} icon="package" delta="ready now"/>
        <StatCard label={`${t('in_washing', lang)} / ${t('in_ironing', lang)}`} value={`${washing} / ${ironing}`} icon="wash"/>
      </div>

      <div className="safi-grid safi-grid--2-1">
        <Card title={t('todays_queue', lang)} action={<Button kind="ghost" size="sm" onClick={() => setView('orders')}>View all →</Button>}>
          <Table
            cols={[
              { label: '#', render: r => <span className="safi-mono">{r.id}</span> },
              { label: 'Customer', render: r => {
                const c = D.customers.find(x => x.id === r.customer);
                return <div><div className="safi-cell-strong">{c?.name || 'Walk-in'}</div><div className="safi-cell-sub">{c?.phone || ''}</div></div>;
              }},
              { label: 'Items', render: r => <span className="safi-cell-sub">{r.items.reduce((s, i) => s + i.qty, 0)} × items</span> },
              { label: 'Total', render: r => <span className="safi-mono">{money(r.total)}</span> },
              { label: 'Payment', render: r => <PayBadge paid={r.paid} total={r.total}/> },
              { label: 'Status', render: r => <StatusBadge status={r.status}/> },
              { label: '', render: r => <button className="safi-rowlink" onClick={(e) => { e.stopPropagation(); setActiveOrderId(r.id); setView('order-detail'); }}>Open →</button> },
            ]}
            rows={queue}
            onRow={(r) => { setActiveOrderId(r.id); setView('order-detail'); }}
            empty="No active orders. Tap New Order to start one."
          />
        </Card>

        <div className="safi-stack">
          <Card title={t('quick_actions', lang)}>
            <div className="safi-quick">
              <button className="safi-quick__btn" onClick={() => setView('new-order')}>
                <span className="safi-quick__ico safi-quick__ico--brand"><Icon name="plus" size={20}/></span>
                <span className="safi-quick__lbl">New Order</span>
                <span className="safi-quick__sub">Tag a fresh intake</span>
              </button>
              <button className="safi-quick__btn" onClick={() => setView('payments')}>
                <span className="safi-quick__ico safi-quick__ico--green"><Icon name="mpesa" size={20}/></span>
                <span className="safi-quick__lbl">Record Payment</span>
                <span className="safi-quick__sub">Enter M-Pesa / bank code</span>
              </button>
              <button className="safi-quick__btn" onClick={() => setView('customers')}>
                <span className="safi-quick__ico safi-quick__ico--violet"><Icon name="users" size={20}/></span>
                <span className="safi-quick__lbl">Customers</span>
                <span className="safi-quick__sub">Lookup & history</span>
              </button>
              <button className="safi-quick__btn" onClick={() => setView('issues')}>
                <span className="safi-quick__ico safi-quick__ico--amber"><Icon name="alert" size={20}/></span>
                <span className="safi-quick__lbl">Raise Issue</span>
                <span className="safi-quick__sub">Log a problem</span>
              </button>
            </div>
          </Card>

          <Card title="Live machines">
            <ul className="safi-mach">
              <li><span className="safi-mach__dot is-run"/><span>Washer 1</span><span className="safi-mach__time">22:14 left</span></li>
              <li><span className="safi-mach__dot is-run"/><span>Washer 2</span><span className="safi-mach__time">04:30 left</span></li>
              <li><span className="safi-mach__dot is-idle"/><span>Washer 3</span><span className="safi-mach__time">idle</span></li>
              <li><span className="safi-mach__dot is-run"/><span>Dryer 1</span><span className="safi-mach__time">11:02 left</span></li>
              <li><span className="safi-mach__dot is-warn"/><span>Dryer 2</span><span className="safi-mach__time">service due</span></li>
            </ul>
          </Card>
        </div>
      </div>

      <Card title={t('recent_orders', lang)} action={<Button kind="ghost" size="sm" onClick={() => setView('orders')}>All orders →</Button>}>
        <div className="safi-orders-strip">
          {D.orders.slice(0, 5).map(o => {
            const c = D.customers.find(x => x.id === o.customer);
            return (
              <div key={o.id} className="safi-orderchip" onClick={() => { setActiveOrderId(o.id); setView('order-detail'); }}>
                <div className="safi-orderchip__hd">
                  <span className="safi-mono">{o.id}</span><StatusBadge status={o.status}/>
                </div>
                <div className="safi-orderchip__name">{c?.name || 'Walk-in'}</div>
                <div className="safi-orderchip__row">
                  <span className="safi-cell-sub">{o.items.length} services</span>
                  <span className="safi-mono safi-cell-strong">{money(o.total)}</span>
                </div>
              </div>
            );
          })}
          {D.orders.length === 0 && <p className="safi-cell-sub">No orders yet — create your first one.</p>}
        </div>
      </Card>
    </>
  );
}

// ─── New Order screen ─────────────────────────────────────────────────────
function NewOrder({ setView, setActiveOrderId, lang, money }) {
  const D = useStore();
  const [customerId, setCustomerId] = useStateFD('');
  const [group, setGroup] = useStateFD('normal');
  const [items, setItems] = useStateFD([{ svc: D.services[0]?.id || 'wash-fold', qty: 5 }]);
  const [discountPct, setDiscountPct] = useStateFD(0);
  const [deposit, setDeposit] = useStateFD(0);
  const [method, setMethod] = useStateFD('mpesa');
  const [txn, setTxn] = useStateFD('');
  const [notes, setNotes] = useStateFD('');
  const [tag, setTag] = useStateFD('');
  const [search, setSearch] = useStateFD('');
  const [showAdd, setShowAdd] = useStateFD(false);
  const [subtypePicker, setSubtypePicker] = useStateFD(null);

  const [showPreview, setShowPreview] = useStateFD(false);

  const customer = D.customers.find(c => c.id === customerId);
  const effGroup = customer ? customer.group : group;
  const isFirstTime = customer && customer.orders === 0;
  const freeBagEnabled = D.settings?.firstTimeBagFree;

  useEffectFD(() => { if (customer) setGroup(customer.group); }, [customerId]);

  const subtotal = items.reduce((s, it) => {
    const svc = D.services.find(x => x.id === it.svc);
    const unit = it.customPrice ?? (svc?.tiers[effGroup] || 0);
    return s + unit * (it.qty || 0);
  }, 0);
  const discount = Math.round(subtotal * (discountPct / 100));
  const total = Math.max(0, subtotal - discount);
  const balance = total;

  const filteredCust = D.customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  function handleSave(thenPrint) {
    if (items.length === 0 || subtotal <= 0) {
      toast('Add at least one priced service', 'error');
      return;
    }
    if (D.settings?.requireTag && !String(tag).trim()) {
      toast('Enter the tag number from the tag book', 'error');
      return;
    }
    const linePriced = items.map(it => {
      const svc = D.services.find(s => s.id === it.svc);
      const unit = it.customPrice ?? (svc?.tiers[effGroup] || 0);
      return { svc: it.svc, subtype: it.subtype || '', qty: it.qty, price: Math.round(unit * (it.qty || 0)) };
    });
    const order = window.SAFI_STORE.createOrder({
      customerId, items: linePriced, total, discount, discountPct,
      paid: 0, method: '—', txn: '',
      notes, tag: String(tag).trim(),
    });

    // The customer's copy. This is the control that matters: once they hold a text
    // naming the order and the number to pay, the order cannot quietly not exist.
    if (customer && customer.phone) {
      const st = D.settings || {};
      const tpl = (D.smsTemplates || {}).intake
        || 'Vazi Safi: order {id} received, {items} item(s), total {total}. Tag {tag}. Pay ONLY to {payto}. Queries {owner}.';
      const body = tpl
        .replace(/\{name\}/g, customer.name.split(' ')[0])
        .replace(/\{id\}/g, order.id)
        .replace(/\{tag\}/g, order.tag || '—')
        .replace(/\{items\}/g, String(items.reduce((n, it) => n + (it.qty || 0), 0)))
        .replace(/\{total\}/g, money(total))
        .replace(/\{payto\}/g, st.payTo || 'the shop till')
        .replace(/\{owner\}/g, st.ownerPhone || '');
      window.SAFI_STORE.logMessage({
        to: `${customer.prefix || ''} ${customer.phone}`.trim(),
        name: customer.name, body, orderId: order.id, stage: 'intake', method: 'sms',
      });
    }

    toast(`Order ${order.id} created`, 'success');
    setActiveOrderId(order.id);
    setView(thenPrint ? 'receipt' : 'order-detail');
  }

  return (
    <>
      <Topbar
        title={t('new_order', lang)}
        subtitle="Tag items, calculate, collect payment, print receipt."
        right={<>
          <Button kind="ghost" onClick={() => setView('dashboard')}>{t('cancel', lang)}</Button>
          <Button kind="ghost" icon="search" onClick={() => setShowPreview(true)}>Preview</Button>
          <Button kind="secondary" icon="check" onClick={() => handleSave(false)}>{t('save', lang)}</Button>
          <Button kind="primary" icon="print" onClick={() => handleSave(true)}>{t('save_and_print', lang)}</Button>
        </>}
      />

      {isFirstTime && (
        <div className="safi-first-banner safi-first-banner--flash">
          <div className="safi-first-banner__icon"><Icon name="bag" size={28}/></div>
          <div className="safi-first-banner__body">
            <b>🎁 FIRST-TIME CUSTOMER · {customer.name}</b>
            <p>
              {freeBagEnabled
                ? 'A complimentary laundry bag will be auto-added to this order. Mention the welcome gift when handing over.'
                : 'New to Vazi Safi! Greet warmly and explain how the process works.'}
            </p>
          </div>
          <div className="safi-first-banner__pill">NEW</div>
        </div>
      )}

      <div className="safi-grid safi-grid--2-1">
        <div className="safi-stack">
          <Card title="1 · Customer">
            <div className="safi-cust-pick">
              <div className="safi-cust-pick__search">
                <Icon name="search" size={16}/>
                <input placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)}/>
                <button className="safi-cust-pick__walk" onClick={() => { setCustomerId(''); setGroup('normal'); }}>Walk-in</button>
                <button className="safi-cust-pick__walk" onClick={() => setShowAdd(true)}>+ New</button>
              </div>
              <div className="safi-cust-pick__list">
                {filteredCust.slice(0, 8).map(c => (
                  <button key={c.id} className={`safi-cust-pick__item ${customerId === c.id ? 'is-active' : ''}`} onClick={() => setCustomerId(c.id)}>
                    <span className="safi-cust-pick__avatar">{c.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
                    <span className="safi-cust-pick__name">
                      <b>{c.name}</b>
                      <span>{c.phone}</span>
                    </span>
                    <GroupBadge group={c.group}/>
                  </button>
                ))}
                {filteredCust.length === 0 && <div className="safi-cell-sub" style={{ padding: 12 }}>No match. Use Walk-in or + New.</div>}
              </div>
              {!customerId && (
                <div className="safi-walkin">
                  <label>Walk-in pricing tier</label>
                  <div className="safi-seg">
                    {['student', 'normal', 'corporate'].map(g => (
                      <button key={g} className={`safi-seg__btn ${group === g ? 'is-active' : ''}`} onClick={() => setGroup(g)}>{t(g, lang)}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="2 · Items & services" action={<button className="safi-rowlink" onClick={() => setItems([...items, { svc: D.services[0]?.id, qty: 1 }])}>+ Add line</button>}>
            <div className="safi-svc-grid">
              {D.services.map(s => (
                <button key={s.id} className="safi-svc-tile" onClick={() => {
                  if (s.subtypes && s.subtypes.length) {
                    setSubtypePicker({ svc: s });
                  } else {
                    setItems([...items, { svc: s.id, qty: 1 }]);
                  }
                }}>
                  <span className="safi-svc-tile__ico"><Icon name={s.icon} size={20}/></span>
                  <span className="safi-svc-tile__lbl">{s.name}</span>
                  <span className="safi-svc-tile__price">{money(s.tiers[effGroup])} / {s.unit}</span>
                  {s.subtypes && <span className="safi-svc-tile__sub">Pick from {s.subtypes.length} types →</span>}
                </button>
              ))}
            </div>

            <div className="safi-items">
              <div className="safi-items__hd">
                <span>Service / Type</span><span>Qty</span><span>Unit price</span><span>Line total</span><span></span>
              </div>
              {items.map((it, i) => {
                const svc = D.services.find(x => x.id === it.svc);
                const unit = it.customPrice ?? (svc?.tiers[effGroup] || 0);
                return (
                  <div key={i} className="safi-items__row">
                    <div className="safi-items__svc">
                      <select value={it.svc} onChange={e => {
                        const next = [...items];
                        const newSvc = D.services.find(s => s.id === e.target.value);
                        next[i] = { ...next[i], svc: e.target.value, subtype: newSvc?.subtypes?.[0] || '' };
                        setItems(next);
                      }}>
                        {D.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {svc?.subtypes && (
                        <select className="safi-items__subtype" value={it.subtype || ''} onChange={e => {
                          const next = [...items]; next[i] = { ...next[i], subtype: e.target.value }; setItems(next);
                        }}>
                          {svc.subtypes.map(st => {
                            const name = typeof st === 'string' ? st : st.name;
                            return <option key={name} value={name}>{name}</option>;
                          })}
                        </select>
                      )}
                    </div>
                    <div className="safi-qty">
                      <button onClick={() => { const n = [...items]; n[i].qty = Math.max(0.5, (n[i].qty || 0) - 0.5); setItems(n); }}>−</button>
                      <input type="number" step="0.5" value={it.qty} onChange={e => { const n = [...items]; n[i].qty = parseFloat(e.target.value) || 0; setItems(n); }}/>
                      <span className="safi-qty__unit">{svc?.unit}</span>
                      <button onClick={() => { const n = [...items]; n[i].qty = (n[i].qty || 0) + 0.5; setItems(n); }}>+</button>
                    </div>
                    <span className="safi-mono">{money(unit)}</span>
                    <span className="safi-mono safi-cell-strong">{money(unit * (it.qty || 0))}</span>
                    <button className="safi-items__del" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="3 · Notes & special instructions">
            <textarea className="safi-textarea" placeholder="e.g. Separate whites, gentle cycle, fragrance-free…" value={notes} onChange={e => setNotes(e.target.value)}/>
            {customer && (
              <div className="safi-residence-row">
                <label>Residence <span className="safi-cell-sub">(optional · saved to customer)</span>
                  <input className="safi-input" defaultValue={customer.location || ''}
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (v !== (customer.location || '')) {
                        window.SAFI_STORE.updateCustomer(customer.id, { location: v });
                        toast('Residence updated');
                      }
                    }}
                    placeholder="e.g. Karen · Kilimani · Westgate Apt 3B"/>
                </label>
              </div>
            )}
          </Card>
        </div>

        <div className="safi-stack safi-summary-rail">
          <Card title="Summary" className="safi-sticky">
            <div className="safi-sum">
              <div className="safi-sum__row"><span>{t('subtotal', lang)}</span><span className="safi-mono">{money(subtotal)}</span></div>
              <div className="safi-sum__row">
                <span>{t('discount', lang)}</span>
                <div className="safi-inline-input">
                  <input type="number" min="0" max="100" value={discountPct} onChange={e => setDiscountPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}/>
                  <span className="safi-pct">%</span>
                  <span className="safi-cell-sub safi-mono" style={{ marginLeft: 6 }}>— {money(discount)}</span>
                </div>
              </div>
              <div className="safi-sum__row safi-sum__row--total"><span>{t('total', lang)}</span><span className="safi-mono">{money(total)}</span></div>

              <div className="safi-sum__divider"/>

              <div className="safi-sum__divider"/>

              <div className="safi-tagentry">
                <label>Tag number{D.settings?.requireTag && <span className="safi-req">required</span>}</label>
                <input className="safi-input safi-mono" value={tag} inputMode="numeric"
                  placeholder="e.g. 10482" onChange={e => setTag(e.target.value.replace(/[^\d-]/g, ''))}/>
                <span className="safi-hint">Read it off the tag you pinned to the bundle.</span>
              </div>

              <div className="safi-callout" style={{ marginBottom: 4 }}>
                <Icon name="wallet" size={14}/>
                <span>Payment is captured later via <b>Collect balance</b> on the order detail (with M-Pesa / Cash / Bank code).</span>
              </div>

              {(D.settings?.payTo || '') && (
                <div className="safi-callout safi-callout--lock">
                  <Icon name="lock" size={14}/>
                  <span>M-Pesa goes to <b className="safi-mono">{D.settings.payTo}</b>{D.settings.payToName ? ` (${D.settings.payToName})` : ''} only.</span>
                </div>
              )}

              <div className="safi-sum__divider"/>
              <div className="safi-sum__row safi-sum__row--balance"><span>{t('balance', lang)}</span><span className="safi-mono">{money(balance)}</span></div>

              <div className="safi-sum__actions">
                <Button kind="ghost" full icon="search" onClick={() => setShowPreview(true)}>Preview</Button>
                <Button kind="secondary" full icon="check" onClick={() => handleSave(false)}>{t('save', lang)}</Button>
                <Button kind="primary" full icon="print" onClick={() => handleSave(true)}>{t('save_and_print', lang)}</Button>
              </div>
            </div>
          </Card>

          {customer && (
            <Card title="Customer history">
              <div className="safi-mini-cust">
                <div className="safi-mini-cust__row"><span>Total orders</span><b>{customer.orders}</b></div>
                <div className="safi-mini-cust__row"><span>Lifetime spend</span><b className="safi-mono">{money(customer.spend)}</b></div>
                <div className="safi-mini-cust__row"><span>Loyalty</span><b>{customer.loyalty} / 10</b></div>
                <div className="safi-mini-cust__loy"><div style={{ width: `${customer.loyalty * 10}%` }}/></div>
                {customer.loyalty >= 9 && <div className="safi-mini-cust__bonus">🎉 Next order: KES 500 off!</div>}
              </div>
            </Card>
          )}
        </div>
      </div>

      <AddCustomerModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={(c) => { setCustomerId(c.id); setShowAdd(false); }}/>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Receipt preview" width={420}
        footer={<>
          <Button kind="ghost" onClick={() => setShowPreview(false)}>Close</Button>
          <Button kind="secondary" icon="check" onClick={() => { setShowPreview(false); handleSave(false); }}>Save</Button>
          <Button kind="primary" icon="print" onClick={() => { setShowPreview(false); handleSave(true); }}>Save & print</Button>
        </>}>
        <NewOrderPreview
          items={items} subtotal={subtotal} discount={discount} discountPct={discountPct}
          total={total} deposit={deposit} balance={balance}
          method={method} txn={txn} notes={notes}
          customer={customer} effGroup={effGroup}
          services={D.services} money={money}/>
      </Modal>

      <Modal open={!!subtypePicker} onClose={() => setSubtypePicker(null)}
        title={subtypePicker ? `Choose ${subtypePicker.svc.name} types & quantities` : ''} width={560}
        footer={<>
          <Button kind="ghost" onClick={() => setSubtypePicker(null)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={() => {
            const picked = (subtypePicker.qty || {});
            const toAdd = [];
            for (const [name, q] of Object.entries(picked)) {
              if (q > 0) {
                const sub = subtypePicker.svc.subtypes.find(s => (typeof s === 'string' ? s : s.name) === name);
                const subObj = typeof sub === 'string' ? { name: sub } : sub;
                toAdd.push({
                  svc: subtypePicker.svc.id, subtype: name, qty: q,
                  // store override price if subtype has explicit price, else fall back to tier
                  customPrice: subObj.price,
                });
              }
            }
            if (!toAdd.length) { toast('Pick at least one with quantity', 'error'); return; }
            setItems([...items, ...toAdd]);
            setSubtypePicker(null);
            toast(`${toAdd.length} item${toAdd.length > 1 ? 's' : ''} added`);
          }}>Add to order</Button>
        </>}>
        {subtypePicker && (
          <div className="safi-subtype-multi">
            <p className="safi-cell-sub" style={{ marginTop: 0 }}>Set quantity for each type. Items with quantity 0 are skipped.</p>
            {subtypePicker.svc.subtypes.map((st, i) => {
              const sub = typeof st === 'string' ? { name: st } : st;
              const tier = subtypePicker.svc.tiers[effGroup] || 0;
              const price = sub.price ?? tier;
              const q = (subtypePicker.qty && subtypePicker.qty[sub.name]) || 0;
              const setQ = (newQ) => setSubtypePicker({ ...subtypePicker, qty: { ...(subtypePicker.qty || {}), [sub.name]: Math.max(0, newQ) }});
              return (
                <div key={i} className={`safi-subtype-multi__row ${q > 0 ? 'is-picked' : ''}`}>
                  <Icon name={subtypePicker.svc.icon} size={16}/>
                  <span className="safi-subtype-multi__name">{sub.name}</span>
                  <span className="safi-subtype-multi__price safi-mono">{money(price)}{sub.price != null && sub.price !== tier ? ' *' : ''}</span>
                  <div className="safi-qty">
                    <button onClick={() => setQ(q - 1)}>−</button>
                    <input type="number" value={q} min="0" onChange={e => setQ(parseInt(e.target.value) || 0)}/>
                    <button onClick={() => setQ(q + 1)}>+</button>
                  </div>
                  <span className="safi-subtype-multi__line safi-mono safi-cell-strong">{q > 0 ? money(price * q) : '—'}</span>
                </div>
              );
            })}
            <p className="safi-hint">* indicates a price specific to this subtype (override from Management).</p>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── Receipt preview (used in New Order before saving) ────────────────────
function NewOrderPreview({ items, subtotal, discount, discountPct, total, deposit, balance, method, txn, customer, effGroup, services, money }) {
  // Group by service
  const groups = [];
  const seen = new Map();
  for (const it of items) {
    if (!seen.has(it.svc)) { seen.set(it.svc, groups.length); groups.push({ svc: it.svc, lines: [] }); }
    groups[seen.get(it.svc)].lines.push(it);
  }
  return (
    <div className="safi-preview">
      <div className="safi-receipt" style={{ width: '100%', boxShadow: 'none', padding: 12 }}>
        <div className="safi-receipt__rule" style={{ marginTop: 0 }}/>
        <div className="safi-receipt__cust">
          <b>{customer?.name || 'Walk-in customer'}</b><br/>
          {customer?.phone || ''}
          {customer && <div><span className="safi-receipt__tag">{customer.group} tier</span></div>}
        </div>
        <div className="safi-receipt__rule"/>
        <table className="safi-receipt__items">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>
            {groups.flatMap((g, gi) => {
              const s = services.find(x => x.id === g.svc);
              const subSum = g.lines.reduce((sum, l) => sum + ((l.customPrice ?? s?.tiers[effGroup] ?? 0) * l.qty), 0);
              if (g.lines.length === 1 && !g.lines[0].subtype) {
                const l = g.lines[0];
                const unit = l.customPrice ?? s?.tiers[effGroup] ?? 0;
                return [<tr key={gi}><td>{s?.name}</td><td>{l.qty} {s?.unit}</td><td className="safi-mono">{money(unit)}</td><td className="safi-mono">{money(unit * l.qty)}</td></tr>];
              }
              return [
                <tr key={`gh${gi}`} className="safi-receipt__items-group"><td colSpan="4"><b>{s?.name}</b></td></tr>,
                ...g.lines.map((l, li) => {
                  const unit = l.customPrice ?? s?.tiers[effGroup] ?? 0;
                  return <tr key={`g${gi}l${li}`} className="safi-receipt__items-sub">
                    <td>{l.subtype || s?.name}</td><td>{l.qty} {s?.unit}</td>
                    <td className="safi-mono">{money(unit)}</td><td className="safi-mono">{money(unit * l.qty)}</td>
                  </tr>;
                }),
                g.lines.length > 1 && <tr key={`gs${gi}`} className="safi-receipt__items-subtotal"><td colSpan="3" style={{ textAlign: 'right' }}>Subtotal</td><td className="safi-mono"><b>{money(subSum)}</b></td></tr>,
              ].filter(Boolean);
            })}
          </tbody>
        </table>
        <div className="safi-receipt__rule"/>
        <dl className="safi-receipt__totals">
          <div><dt>Subtotal</dt><dd className="safi-mono">{money(subtotal)}</dd></div>
          {discountPct > 0 && <div><dt>Discount ({discountPct}%)</dt><dd className="safi-mono">— {money(discount)}</dd></div>}
          <div className="safi-receipt__grand"><dt>TOTAL</dt><dd className="safi-mono">{money(total)}</dd></div>
          {deposit > 0 && <div><dt>Paid ({method.toUpperCase()})</dt><dd className="safi-mono">{money(deposit)}</dd></div>}
          {txn && <div><dt>Txn</dt><dd className="safi-mono">{txn}</dd></div>}
          {balance > 0 && <div><dt>Balance</dt><dd className="safi-mono">{money(balance)}</dd></div>}
        </dl>
        {balance > 0 && (
          <div className="safi-receipt__balance">
            <div className="safi-receipt__balance-lbl">BALANCE DUE ON COLLECTION</div>
            <div className="safi-receipt__balance-amt safi-mono">{money(balance)}</div>
          </div>
        )}
      </div>
      <p className="safi-cell-sub" style={{ textAlign: 'center', marginTop: 12 }}>This is a preview — order not yet saved.</p>
    </div>
  );
}

// ─── Add Customer Modal (reusable) ────────────────────────────────────────
function AddCustomerModal({ open, onClose, onCreated }) {
  const [name, setName]     = useStateFD('');
  const [prefix, setPrefix] = useStateFD('+254');
  const [phone, setPhone]   = useStateFD('');
  const [group, setGroup]   = useStateFD('normal');
  const [residence, setResidence] = useStateFD('');

  useEffectFD(() => { if (open) { setName(''); setPrefix('+254'); setPhone(''); setGroup('normal'); setResidence(''); } }, [open]);

  function submit() {
    if (!name.trim()) { toast('Name required', 'error'); return; }
    const fullPhone = phone ? `${prefix} ${phone.trim()}` : '';
    const c = window.SAFI_STORE.addCustomer({
      name: name.trim(), phone: fullPhone, prefix, group,
      location: residence.trim(),
    });
    toast(`${c.name} added`, 'success');
    onCreated?.(c);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add customer"
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" icon="check" onClick={submit}>Add customer</Button>
      </>}>
      <div className="safi-form">
        <label>Name<input className="safi-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane Wanjiku"/></label>
        <label>Phone
          <PhoneInput prefix={prefix} phone={phone} onChange={(v) => { setPrefix(v.prefix); setPhone(v.phone); }}/>
        </label>
        <label>Pricing tier
          <div className="safi-seg">
            {['student', 'normal', 'corporate'].map(g => (
              <button key={g} className={`safi-seg__btn ${group === g ? 'is-active' : ''}`} onClick={() => setGroup(g)}>{g[0].toUpperCase() + g.slice(1)}</button>
            ))}
          </div>
        </label>
        <label>Residence <span className="safi-cell-sub">(optional)</span>
          <input className="safi-input" value={residence} onChange={e => setResidence(e.target.value)} placeholder="e.g. Karen · Kilimani · Westgate Apt 3B"/>
        </label>
      </div>
    </Modal>
  );
}

// ─── Orders queue ─────────────────────────────────────────────────────────
function OrdersQueue({ setView, setActiveOrderId, lang, money, role }) {
  const D = useStore();
  const [filter, setFilter] = useStateFD('active'); // default: active orders only
  const [q, setQ] = useStateFD('');
  const [dateFilter, setDateFilter] = useStateFD(''); // empty = no date filter

  const filtered = D.orders.filter(o => {
    // Status filter
    if (filter === 'active') { if (o.status === 'collected') return false; }
    else if (filter !== 'all' && o.status !== filter) return false;
    // Date filter
    if (dateFilter && !o.in.startsWith(dateFilter)) return false;
    // Search
    if (q) {
      const c = D.customers.find(x => x.id === o.customer);
      const hay = (o.id + ' ' + (c?.name || '') + ' ' + (c?.phone || '')).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const statusCounts = ['intake', 'washing', 'drying', 'ironing', 'ready', 'collected'].map(s => ({ s, n: D.orders.filter(o => o.status === s).length }));
  const activeCount = D.orders.filter(o => o.status !== 'collected').length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);

  return (
    <>
      <Topbar
        title={t('nav_orders', lang)}
        subtitle={`${activeCount} active · ${D.orders.length} all-time${dateFilter ? ` · viewing ${dateFilter}` : ''}`}
        right={<>
          {role === 'owner' && <Button kind="ghost" icon="print" onClick={() => window.print()}>{t('print', lang)}</Button>}
          <Button kind="primary" icon="plus" onClick={() => setView('new-order')}>{t('new_order', lang)}</Button>
        </>}
      />

      <div className="safi-status-strip">
        <button className={`safi-status-strip__btn ${filter === 'active' ? 'is-active' : ''}`} onClick={() => setFilter('active')}>
          <span>Active</span><b>{activeCount}</b>
        </button>
        <button className={`safi-status-strip__btn ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
          <span>All time</span><b>{D.orders.length}</b>
        </button>
        {statusCounts.map(({ s, n }) => (
          <button key={s} className={`safi-status-strip__btn ${filter === s ? 'is-active' : ''}`} onClick={() => setFilter(s)}>
            <StatusBadge status={s}/><b>{n}</b>
          </button>
        ))}
      </div>

      <Card pad={false}>
        <div className="safi-toolbar">
          <div className="safi-cust-pick__search safi-cust-pick__search--inline">
            <Icon name="search" size={16}/>
            <input placeholder="Search order #, customer name or phone…" value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div className="safi-toolbar__filters">
            <button className={`safi-chip ${dateFilter === todayStr ? 'is-active' : ''}`} onClick={() => setDateFilter(todayStr)}>Today</button>
            <button className={`safi-chip ${dateFilter === yesterdayStr ? 'is-active' : ''}`} onClick={() => setDateFilter(yesterdayStr)}>Yesterday</button>
            <button className={`safi-chip ${!dateFilter ? 'is-active' : ''}`} onClick={() => setDateFilter('')}>Any date</button>
            <input type="date" className="safi-input safi-input--inline" value={dateFilter} onChange={e => setDateFilter(e.target.value)} max={todayStr} title="Pick a specific date"/>
          </div>
        </div>

        <Table
          cols={[
            { label: t('order_id', lang), render: r => <span className="safi-mono safi-cell-strong">{r.id}</span> },
            { label: t('customer', lang), render: r => {
                const c = D.customers.find(x => x.id === r.customer);
                return <div><div className="safi-cell-strong">{c?.name || 'Walk-in'}</div><div className="safi-cell-sub">{c?.phone || ''}</div></div>;
              }},
            { label: 'In', render: r => <span className="safi-cell-sub">{r.in.slice(5, 16)}</span> },
            { label: 'Due', render: r => <span className="safi-cell-sub">{(r.due || '').slice(5, 16)}</span> },
            { label: 'Items', render: r => <span>{r.items.map(i => D.services.find(s => s.id === i.svc)?.name.split(' ')[0]).join(', ')}</span> },
            { label: t('total', lang), render: r => <span className="safi-mono">{money(r.total)}</span> },
            { label: t('paid', lang), render: r => <PayBadge paid={r.paid} total={r.total}/> },
            { label: t('method', lang), render: r => <MethodBadge method={r.method}/> },
            { label: t('status', lang), render: r => <StatusBadge status={r.status}/> },
            { label: '', render: r => <button className="safi-rowlink" onClick={(e) => { e.stopPropagation(); setActiveOrderId(r.id); setView('order-detail'); }}>Open →</button> },
          ]}
          rows={filtered}
          onRow={r => { setActiveOrderId(r.id); setView('order-detail'); }}
          empty={dateFilter ? `No orders on ${dateFilter}.` : "No orders match your filter."}
        />
      </Card>
    </>
  );
}

// ─── Order Detail ─────────────────────────────────────────────────────────
function OrderDetail({ orderId, setView, lang, money, role }) {
  const D = useStore();
  const o = D.orders.find(x => x.id === orderId) || D.orders[0];
  const [showPay, setShowPay] = useStateFD(false);
  const [showRewash, setShowRewash] = useStateFD(false);
  const [showDelete, setShowDelete] = useStateFD(false);
  const [showAdvance, setShowAdvance] = useStateFD(false);
  const [showEdit, setShowEdit] = useStateFD(false);
  const isManagement = role === 'owner';
  if (!o) return <div style={{ padding: 40 }}><h2>No order selected.</h2><Button onClick={() => setView('orders')}>Back to orders</Button></div>;
  const c = D.customers.find(x => x.id === o.customer);
  const stages = window.SAFI_STORE.STAGES;
  const curIdx = stages.indexOf(o.status);
  const parent = o.rewashOf ? D.orders.find(x => x.id === o.rewashOf) : null;
  const rewashChild = o.rewashedBy ? D.orders.find(x => x.id === o.rewashedBy) : null;

  function markCollected() {
    const balance = (o.total || 0) - (o.paid || 0);
    window.SAFI_STORE.updateOrder(o.id, { status: 'collected' });
    window.SAFI_STORE.logRelease({
      orderId: o.id, tag: o.tag || '',
      releasedTo: c?.name || 'Walk-in', balanceAtRelease: balance,
    });
    toast('Order marked Collected', 'success');
    // Mandatory SMS for collection
    if (c && c.phone) {
      const tpl = (D.smsTemplates || {}).collected || 'Hi {name}, your order {id} has been collected. Asante, karibu tena!';
      const body = tpl
        .replace(/\{name\}/g, c.name.split(' ')[0])
        .replace(/\{id\}/g, o.id)
        .replace(/\{balance\}/g, `KES ${Math.round(o.total - o.paid).toLocaleString('en-KE')}`)
        .replace(/\{due\}/g, '')
        .replace(/\{rider\}/g, '—');
      window.SAFI_STORE.logMessage({
        to: `${c.prefix || ''} ${c.phone}`.trim(),
        name: c.name, body,
        orderId: o.id, stage: 'collected',
        method: 'sms',
      });
      toast(`SMS sent to ${c.name}`);
    }
  }

  return (
    <>
      <Topbar
        title={<><span className="safi-back" onClick={() => setView('orders')}><Icon name="arrow-l" size={16}/></span> Order <span className="safi-mono">{o.id}</span>{o.rewashOf && <span className="safi-tag safi-tag--violet" style={{ marginLeft: 8 }}>REWASH</span>}{o.rewashedBy && <span className="safi-tag safi-tag--amber" style={{ marginLeft: 8 }}>Has rewash</span>}</>}
        subtitle={`${c?.name || 'Walk-in'} · placed ${o.in.slice(5, 16)} · due ${(o.due || '').slice(5, 16)}${parent ? ` · rewash of ${parent.id}` : ''}`}
        right={<>
          <Button kind="ghost" icon="wrench" onClick={() => setShowRewash(true)}>Rewash (free)</Button>
          <Button kind="ghost" icon="pen" onClick={() => setShowEdit(true)}>Edit</Button>
          <Button kind="ghost" icon="alert" onClick={() => setView('issues')}>Issue</Button>
          <Button kind="ghost" icon="print" onClick={() => setView('receipt')}>{t('print', lang)}</Button>
          {curIdx < 4 && <Button kind="primary" icon="arrow" onClick={() => { setShowAdvance(true); }}>Advance → {stages[curIdx + 1]}</Button>}
          <Button kind="ghost" onClick={() => setShowDelete(true)} icon="alert"><span style={{ color: 'var(--red)' }}>Delete</span></Button>
        </>}
      />

      <Card>
        <div className="safi-stepper">
          {stages.map((s, i) => (
            <div key={s} className={`safi-stepper__node ${i < curIdx ? 'is-done' : i === curIdx ? 'is-cur' : ''} ${(s === 'collected' && o.status === 'ready') ? 'is-clickable' : ''}`}
                 onClick={() => { if (s === 'collected' && o.status === 'ready') markCollected(); }}
                 title={s === 'collected' && o.status === 'ready' ? 'Click to mark as Collected' : ''}>
              <div className="safi-stepper__dot">
                {i < curIdx ? <Icon name="check" size={14} stroke="#fff"/> : <span>{i + 1}</span>}
              </div>
              <div className="safi-stepper__lbl">{t(s, lang)}</div>
              {i < stages.length - 1 && <div className={`safi-stepper__line ${i < curIdx ? 'is-done' : ''}`}/>}
            </div>
          ))}
        </div>
        {o.status === 'ready' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <Button kind="primary" icon="check" onClick={markCollected}>Mark as Collected</Button>
          </div>
        )}
      </Card>

      <div className="safi-grid safi-grid--2-1">
        <div className="safi-stack">
          <Card title="Items">
            <Table
              cols={[
                { label: 'Service', render: r => {
                    const s = D.services.find(x => x.id === r.svc);
                    return <span><Icon name={s?.icon} size={14}/> <b style={{ marginLeft: 6 }}>{s?.name}{r.subtype ? ` · ${r.subtype}` : ''}</b>{r.free && <span className="safi-tag safi-tag--green" style={{ marginLeft: 6 }}>FREE</span>}{r.note && <div className="safi-cell-sub">{r.note}</div>}</span>;
                  }},
                { label: 'Qty', render: r => <span>{r.qty} {D.services.find(x => x.id === r.svc)?.unit}</span> },
                { label: 'Unit price', render: r => <span className="safi-mono">{money(r.qty ? r.price / r.qty : 0)}</span> },
                { label: 'Line total', render: r => <span className={`safi-mono ${r.price > 0 ? 'safi-cell-strong' : 'safi-cell-sub'}`}>{r.price > 0 ? money(r.price) : '—'}</span> },
              ]}
              rows={o.items}
            />
            <div className="safi-sum safi-sum--inline">
              <div className="safi-sum__row"><span>{t('subtotal', lang)}</span><span className="safi-mono">{money(o.total + (o.discount || 0))}</span></div>
              <div className="safi-sum__row"><span>{t('discount', lang)}</span><span className="safi-mono">— {money(o.discount || 0)}</span></div>
              <div className="safi-sum__row safi-sum__row--total"><span>{t('total', lang)}</span><span className="safi-mono">{money(o.total)}</span></div>
            </div>
          </Card>
        </div>

        <div className="safi-stack">
          <Card title="Customer">
            <div className="safi-cust-card">
              <div className="safi-cust-card__avatar">{(c?.name || 'WI').split(' ').map(s => s[0]).slice(0, 2).join('')}</div>
              <div>
                <div className="safi-cust-card__name">{c?.name || 'Walk-in'}</div>
                {c && <div className="safi-cust-card__phone"><Icon name="phone" size={12}/> {c.phone}</div>}
                <div className="safi-cust-card__meta">
                  {c && <GroupBadge group={c.group}/>}
                  {c && <span className="safi-cell-sub">· {c.orders} orders · {money(c.spend)} lifetime</span>}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Payment">
            <div className="safi-paybox">
              <div className="safi-paybox__row"><span>{t('total', lang)}</span><b className="safi-mono">{money(o.total)}</b></div>
              <div className="safi-paybox__row"><span>{t('paid', lang)}</span><b className="safi-mono">{money(o.paid)}</b></div>
              <div className="safi-paybox__row safi-paybox__row--balance"><span>{t('balance', lang)}</span><b className="safi-mono">{money(o.total - o.paid)}</b></div>
              <div className="safi-paybox__meta">
                <MethodBadge method={o.method}/>
                {o.txn && <span className="safi-mono safi-cell-sub">{o.txn}</span>}
              </div>
              {o.total - o.paid > 0 && <Button kind="primary" full icon="wallet" onClick={() => setShowPay(true)}>Collect balance · {money(o.total - o.paid)}</Button>}
            </div>
          </Card>

          {o.notes && (
            <Card title="Notes">
              <p className="safi-notes">{o.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <PaymentModal open={showPay} onClose={() => setShowPay(false)}
        orderId={o.id} suggested={o.total - o.paid}
        customerName={c?.name || 'Walk-in'}/>

      <ApprovalRequestModal
        open={showRewash} onClose={() => setShowRewash(false)}
        action="rewash_order" target={o.id}
        title="Rewash items free of charge"
        description={`Items from ${o.id} will be re-processed at no charge as a new linked order.`}
        confirmLabel={isManagement ? 'Create rewash now' : 'Request approval'}
        isManagement={isManagement}
        onDirectApprove={() => {
          const r = window.SAFI_STORE.createRewash(o.id);
          toast(`Rewash ${r.id} created (free)`);
          setView('orders');
        }}/>

      <ApprovalRequestModal
        open={showDelete} onClose={() => setShowDelete(false)}
        action="delete_order" target={o.id}
        title={`Delete order ${o.id}?`}
        description="This permanently removes the order and any linked payments. The customer's order count is reversed."
        confirmLabel={isManagement ? 'Delete permanently' : 'Request approval to delete'}
        isManagement={isManagement}
        danger
        onDirectApprove={() => {
          window.SAFI_STORE.deleteOrder(o.id);
          toast(`Order ${o.id} deleted`);
          setView('orders');
        }}/>

      <AdvanceModal
        open={showAdvance} onClose={() => setShowAdvance(false)}
        order={o} customer={c} stages={stages} curIdx={curIdx}/>

      <EditOrderModal
        open={showEdit} onClose={() => setShowEdit(false)}
        order={o} isManagement={isManagement}/>
    </>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────
function PaymentModal({ open, onClose, orderId, suggested = 0, customerName = '' }) {
  const [method, setMethod] = useStateFD('mpesa');
  const [amount, setAmount] = useStateFD(suggested);
  const [txn, setTxn]       = useStateFD('');

  useEffectFD(() => { if (open) { setAmount(suggested); setTxn(''); setMethod('mpesa'); } }, [open, suggested]);

  function submit() {
    if (amount <= 0) { toast('Enter amount', 'error'); return; }
    window.SAFI_STORE.recordPayment({ orderId, method, amount, txn, customer: customerName });
    toast(`Payment recorded`, 'success');
    onClose();
  }

  const txnLabel = method === 'cash' ? 'Cash Deposit Reference'
                : method === 'mpesa' ? 'M-Pesa transaction code'
                : 'Bank reference';
  const txnPlaceholder = method === 'cash' ? 'e.g. internal slip #'
                       : method === 'mpesa' ? 'TGW8KL2M91'
                       : 'BNK-554210';

  return (
    <Modal open={open} onClose={onClose} title={`Record payment · ${orderId}`}
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" icon="check" onClick={submit}>Record payment</Button>
      </>}>
      <div className="safi-form">
        <label>Method
          <div className="safi-seg safi-seg--full">
            {['mpesa', 'cash', 'bank'].map(m => (
              <button key={m} className={`safi-seg__btn ${method === m ? 'is-active' : ''}`} onClick={() => setMethod(m)}>
                <Icon name={m === 'mpesa' ? 'mpesa' : 'wallet'} size={14}/>
                {m === 'mpesa' ? 'M-Pesa' : m === 'cash' ? 'Cash' : 'Bank'}
              </button>
            ))}
          </div>
        </label>
        <label>Amount (KES)<input type="number" className="safi-input safi-mono" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)}/></label>
        <label>{txnLabel}<input className="safi-input safi-mono" value={txn} onChange={e => setTxn(e.target.value.toUpperCase())} placeholder={txnPlaceholder}/></label>
        <p className="safi-hint">Saved to ledger for monthly audit. <b>Verified by Management</b> against M-Pesa/bank statements.</p>
      </div>
    </Modal>
  );
}

// ─── Advance modal (advance + optional SMS) ───────────────────────────────
function AdvanceModal({ open, onClose, order, customer, stages, curIdx }) {
  const D = useStore();
  const nextStage = stages[curIdx + 1];
  // Allow skipping ironing if next stage is ironing
  const canSkipIroning = nextStage === 'ironing' && stages[curIdx + 2] === 'ready';
  // Default: SKIP ironing. Toggle ON = include ironing
  const [includeIroning, setIncludeIroning] = useStateFD(false);
  const targetStage = (canSkipIroning && !includeIroning) ? 'ready' : nextStage;
  // SMS is mandatory for washing & collected, optional for others
  const smsMandatory = targetStage === 'washing' || targetStage === 'ready' || targetStage === 'collected';

  const [sendSms, setSendSms] = useStateFD(true);
  const [body, setBody]       = useStateFD('');
  const [whichKey, setWhich]  = useStateFD(targetStage);
  const [editing, setEditing] = useStateFD(false);

  // Build template list (built-in stages + custom)
  const templates = D.smsTemplates || {};
  const allKeys = Object.keys(templates);
  const customKeys = allKeys.filter(k => !['ready', 'washing', 'ironing', 'drying', 'collected', 'delivery'].includes(k));

  function renderTpl(key) {
    const tpl = templates[key] || '';
    if (!customer) return tpl;
    return tpl
      .replace(/\{name\}/g, customer.name.split(' ')[0])
      .replace(/\{id\}/g, order.id)
      .replace(/\{balance\}/g, `KES ${Math.round(order.total - order.paid).toLocaleString('en-KE')}`)
      .replace(/\{due\}/g, (order.due || '').slice(5, 16))
      .replace(/\{rider\}/g, '—');
  }

  useEffectFD(() => {
    if (open) {
      setBody(renderTpl(targetStage));
      setSendSms(true);
      setIncludeIroning(false);
    }
  }, [open]);

  useEffectFD(() => {
    setBody(renderTpl(targetStage));
    if (smsMandatory) setSendSms(true);
  }, [includeIroning, targetStage]);

  function doAdvance(includeSms) {
    if (canSkipIroning && !includeIroning) {
      // Skip ironing: advance from drying directly to ready (advance twice)
      window.SAFI_STORE.advanceStatus(order.id); // drying → ironing
      window.SAFI_STORE.advanceStatus(order.id); // ironing → ready
    } else {
      window.SAFI_STORE.advanceStatus(order.id);
    }
    toast(`Moved to ${targetStage}`);
    if (includeSms && customer && customer.phone && body.trim()) {
      window.SAFI_STORE.logMessage({
        to: `${customer.prefix || ''} ${customer.phone}`.trim(),
        name: customer.name, body: body.trim(),
        orderId: order.id, stage: targetStage,
        method: 'sms',
      });
    }
    onClose();
  }

  if (!order || !nextStage) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Advance order`} width={560}
      footer={<>
        {!smsMandatory && <Button kind="ghost" onClick={() => doAdvance(false)}>Advance, skip SMS</Button>}
        <Button kind="primary" icon="check" onClick={() => doAdvance(sendSms || smsMandatory)}>Advance{(sendSms || smsMandatory) ? ' & send SMS' : ''}</Button>
      </>}>
      <div className="safi-form">
        <div className="safi-callout">
          <Icon name="arrow" size={14}/>
          <span>Stage: <b>{stages[curIdx]}</b> → <b>{targetStage}</b></span>
        </div>

        {canSkipIroning && (
          <label className="safi-toggle">
            <input type="checkbox" checked={includeIroning} onChange={e => setIncludeIroning(e.target.checked)}/>
            <span/>
            <b>Include ironing for this order</b>
          </label>
        )}

        {customer && customer.phone ? (
          <>
            {smsMandatory ? (
              <div className="safi-callout" style={{ background: 'var(--green-bg)', color: 'var(--green)', borderLeft: '3px solid var(--green)' }}>
                <Icon name="sms" size={14}/>
                <span><b>SMS will be sent</b> — mandatory for {targetStage} stage</span>
              </div>
            ) : (
              <label className="safi-toggle">
                <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)}/>
                <span/>
                <b>Send SMS notification to {customer.name} ({customer.prefix} {customer.phone})</b>
              </label>
            )}

            {(sendSms || smsMandatory) && (
              <label>SMS message
                <textarea className="safi-textarea" value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 100 }}/>
                <p className="safi-hint">Edit freely before sending. Logged to Messages screen.</p>
              </label>
            )}
          </>
        ) : (
          <p className="safi-cell-sub">No phone number on file for {customer?.name || 'this customer'}. {smsMandatory ? '⚠ SMS is mandatory for this stage — please add a phone number first.' : 'Add one in Customers to enable SMS.'}</p>
        )}
      </div>
    </Modal>
  );
}

// ─── Approval request modal ───────────────────────────────────────────────
function ApprovalRequestModal({ open, onClose, action, target, title, description, confirmLabel, isManagement, danger, onDirectApprove }) {
  const [reason, setReason] = useStateFD('');

  useEffectFD(() => { if (open) setReason(''); }, [open]);

  function submit() {
    if (isManagement) {
      onDirectApprove();
      onClose();
      return;
    }
    if (!reason.trim()) { toast('Reason required', 'error'); return; }
    window.SAFI_STORE.requestApproval({ action, target, reason: reason.trim() });
    toast('Sent to Management for approval');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} width={460}
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind={danger ? 'primary' : 'primary'} icon="check" onClick={submit}>{confirmLabel}</Button>
      </>}>
      <p className="safi-cell-sub" style={{ marginTop: 0 }}>{description}</p>
      {!isManagement && (
        <div className="safi-form">
          <div className="safi-callout">
            <Icon name="lock" size={14}/>
            <span>Only Management can confirm this. Your request will appear in their Approvals queue.</span>
          </div>
          <label>Reason / context<textarea className="safi-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this needed? Customer complaint, mistake, duplicate…"/></label>
        </div>
      )}
    </Modal>
  );
}

// ─── Edit Order modal (with approval if not management) ──────────────────
function EditOrderModal({ open, onClose, order, isManagement }) {
  const D = useStore();
  const [items, setItems]   = useStateFD([]);
  const [notes, setNotes]   = useStateFD('');
  const [reason, setReason] = useStateFD('');

  useEffectFD(() => {
    if (open && order) {
      setItems(order.items.map(it => ({ ...it })));
      setNotes(order.notes || '');
      setReason('');
    }
  }, [open, order]);

  if (!order) return null;
  const cust = D.customers.find(c => c.id === order.customer);
  const group = cust?.group || 'normal';

  // Recompute total from items
  const newTotal = items.reduce((s, it) => s + (it.price || 0), 0);

  function changeQty(idx, qty) {
    const next = [...items];
    next[idx].qty = qty;
    const svc = D.services.find(s => s.id === next[idx].svc);
    if (svc && !next[idx].free) {
      next[idx].price = Math.round((svc.tiers[group] || 0) * qty);
    }
    setItems(next);
  }
  function removeItem(idx) { setItems(items.filter((_, i) => i !== idx)); }
  function addItem() {
    const svc = D.services[0];
    setItems([...items, { svc: svc.id, qty: 1, price: svc.tiers[group] || 0, free: false }]);
  }

  function submit() {
    const payload = { items, total: newTotal, notes };
    if (isManagement) {
      window.SAFI_STORE.updateOrder(order.id, payload);
      toast('Order updated', 'success');
      onClose();
    } else {
      if (!reason.trim()) { toast('Reason required', 'error'); return; }
      window.SAFI_STORE.requestApproval({
        action: 'edit_order', target: order.id, reason: reason.trim(), payload,
      });
      toast('Edit sent to Management for approval');
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit order ${order.id}`} width={680}
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" icon="check" onClick={submit}>{isManagement ? 'Save changes' : 'Request approval'}</Button>
      </>}>
      <div className="safi-form">
        {!isManagement && (
          <div className="safi-callout">
            <Icon name="lock" size={14}/>
            <span>Only Management can confirm an order edit. Your changes will appear in the Approvals queue.</span>
          </div>
        )}

        <h4 className="safi-section-h">Items</h4>
        <div className="safi-items" style={{ marginTop: 0 }}>
          <div className="safi-items__hd">
            <span>Service</span><span>Qty</span><span>Unit price</span><span>Line total</span><span></span>
          </div>
          {items.map((it, i) => {
            const svc = D.services.find(s => s.id === it.svc);
            const unit = svc?.tiers[group] || 0;
            return (
              <div key={i} className="safi-items__row">
                <select value={it.svc} onChange={e => {
                  const next = [...items];
                  next[i].svc = e.target.value;
                  const newSvc = D.services.find(s => s.id === e.target.value);
                  next[i].price = it.free ? 0 : Math.round((newSvc?.tiers[group] || 0) * it.qty);
                  setItems(next);
                }}>
                  {D.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="safi-qty">
                  <button onClick={() => changeQty(i, Math.max(0.5, (it.qty || 0) - 0.5))}>−</button>
                  <input type="number" step="0.5" value={it.qty} onChange={e => changeQty(i, parseFloat(e.target.value) || 0)}/>
                  <span className="safi-qty__unit">{svc?.unit}</span>
                  <button onClick={() => changeQty(i, (it.qty || 0) + 0.5)}>+</button>
                </div>
                <span className="safi-mono">{it.free ? 'FREE' : `KES ${unit}`}</span>
                <span className="safi-mono safi-cell-strong">{it.free ? '—' : `KES ${(it.price || 0).toLocaleString()}`}</span>
                <button className="safi-items__del" onClick={() => removeItem(i)}>×</button>
              </div>
            );
          })}
        </div>
        <button className="safi-rowlink" onClick={addItem}>+ Add line</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--paper)', borderRadius: '10px', fontWeight: 700 }}>
          <span>New total</span>
          <span className="safi-mono">KES {newTotal.toLocaleString()}</span>
        </div>

        <label>Notes
          <textarea className="safi-textarea" value={notes} onChange={e => setNotes(e.target.value)}/>
        </label>

        {!isManagement && (
          <label>Reason for edit (required)
            <textarea className="safi-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Customer added items, wrong quantity, etc."/>
          </label>
        )}
      </div>
    </Modal>
  );
}

// ─── Receipt (printable) ──────────────────────────────────────────────────
function Receipt({ orderId, setView, lang, money, shop }) {
  const D = useStore();
  const o = D.orders.find(x => x.id === orderId) || D.orders[0];
  if (!o) return <div style={{ padding: 40 }}>No order.</div>;
  const c = D.customers.find(x => x.id === o.customer);

  return (
    <>
      <Topbar
        title="Receipt"
        subtitle="80mm thermal-printer optimized. Print this, then print the job card & delivery note."
        right={<>
          <Button kind="ghost" onClick={() => setView('order-detail')}><Icon name="arrow-l" size={14}/> Back</Button>
          <Button kind="secondary" icon="print" onClick={() => window.print()}>{t('print', lang)}</Button>
          <Button kind="primary" icon="card" onClick={() => setView('job-card')}>Job card &amp; delivery note →</Button>
        </>}
      />

      <div className="safi-receipt-wrap">
        <div className="safi-receipt" id="safi-print-area">
          <div className="safi-receipt__hd">
            <div className="safi-receipt__logo">
              <image-slot id="shop-logo-full" shape="rect"
                          src={window.VAZI_LOGO_LOCKUP || 'assets/vazi-logo-full.png'}
                          placeholder="Drop logo"
                          style={{ width: '220px', height: '220px' }}>
              </image-slot>
            </div>
            <div className="safi-receipt__name">{shop?.name || 'VAZI SAFI LAUNDRY'}</div>
            <div className="safi-receipt__addr">{shop?.address || ''}</div>
            <div className="safi-receipt__addr">{shop?.kra || ''}</div>
          </div>

          <div className="safi-receipt__rule"/>

          <div className="safi-receipt__meta">
            <div><span>Receipt #</span><b className="safi-mono">{o.id}</b></div>
            {o.queueNo && <div><span>Client #</span><b className="safi-mono">{String(o.queueNo).padStart(2, '0')}</b></div>}
            {o.tag && <div><span>Tag #</span><b className="safi-mono">{o.tag}</b></div>}
            <div><span>Date</span><b>{o.in}</b></div>
            <div><span>Cashier</span><b>{(D.staff.find(s => s.id === (o.cashier || D.currentStaffId)) || D.staff[0])?.name || '—'}</b></div>
            <div><span>Due</span><b>{(o.due || '').slice(5, 16)}</b></div>
          </div>

          <div className="safi-receipt__rule"/>

          <div className="safi-receipt__cust">
            <b>{c?.name || 'Walk-in customer'}</b><br/>
            {c?.phone || ''}<br/>
            {c && <span className="safi-receipt__tag">{c.group} tier</span>}
          </div>

          <div className="safi-receipt__rule safi-receipt__rule--dash"/>

          <table className="safi-receipt__items">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>
              {(() => {
                // Group items by service id, preserving insertion order
                const groups = [];
                const seen = new Map();
                for (const it of o.items) {
                  if (!seen.has(it.svc)) { const idx = groups.length; seen.set(it.svc, idx); groups.push({ svc: it.svc, lines: [] }); }
                  groups[seen.get(it.svc)].lines.push(it);
                }
                return groups.flatMap((g, gi) => {
                  const s = D.services.find(x => x.id === g.svc);
                  const groupSubtotal = g.lines.reduce((sum, l) => sum + (l.price || 0), 0);
                  // If only one line and no subtype, render flat (no header / subtotal)
                  if (g.lines.length === 1 && !g.lines[0].subtype) {
                    const l = g.lines[0];
                    return [
                      <tr key={`g${gi}`}>
                        <td>{s?.name}{l.free && ' (free)'}</td>
                        <td>{l.qty} {s?.unit}</td>
                        <td className="safi-mono">{money(l.qty ? l.price / l.qty : 0)}</td>
                        <td className="safi-mono">{money(l.price)}</td>
                      </tr>
                    ];
                  }
                  return [
                    <tr key={`gh${gi}`} className="safi-receipt__items-group">
                      <td colSpan="4"><b>{s?.name}</b></td>
                    </tr>,
                    ...g.lines.map((l, li) => (
                      <tr key={`g${gi}l${li}`} className="safi-receipt__items-sub">
                        <td>{l.subtype || s?.name}{l.free && ' (free)'}</td>
                        <td>{l.qty} {s?.unit}</td>
                        <td className="safi-mono">{money(l.qty ? l.price / l.qty : 0)}</td>
                        <td className="safi-mono">{money(l.price)}</td>
                      </tr>
                    )),
                    g.lines.length > 1 && (
                      <tr key={`gs${gi}`} className="safi-receipt__items-subtotal">
                        <td colSpan="3" style={{ textAlign: 'right' }}>Subtotal</td>
                        <td className="safi-mono"><b>{money(groupSubtotal)}</b></td>
                      </tr>
                    ),
                  ].filter(Boolean);
                });
              })()}
            </tbody>
          </table>

          <div className="safi-receipt__rule safi-receipt__rule--dash"/>

          <dl className="safi-receipt__totals">
            <div><dt>Subtotal</dt><dd className="safi-mono">{money(o.total + (o.discount || 0))}</dd></div>
            <div><dt>Discount</dt><dd className="safi-mono">— {money(o.discount || 0)}</dd></div>
            <div className="safi-receipt__grand"><dt>TOTAL</dt><dd className="safi-mono">{money(o.total)}</dd></div>
            <div><dt>Paid ({(o.method || '—').toUpperCase()})</dt><dd className="safi-mono">{money(o.paid)}</dd></div>
            {o.txn && <div><dt>Txn code</dt><dd className="safi-mono">{o.txn}</dd></div>}
            <div><dt>Balance</dt><dd className="safi-mono">{money(o.total - o.paid)}</dd></div>
          </dl>

          <div className="safi-receipt__rule"/>

          {(shop?.mpesaTill || shop?.bank) && (
            <div className="safi-receipt__pay">
              <div className="safi-receipt__pay-title">HOW TO PAY THE BALANCE</div>
              {shop?.mpesaTill && <div className="safi-receipt__pay-line">{shop.mpesaTill}</div>}
              {shop?.bank && <div className="safi-receipt__pay-line">{shop.bank}</div>}
              <div className="safi-receipt__pay-line safi-receipt__pay-line--sub">Or pay cash on collection</div>
            </div>
          )}

          {o.total - o.paid > 0 && (
            <div className="safi-receipt__balance">
              <div className="safi-receipt__balance-lbl">BALANCE DUE ON COLLECTION</div>
              <div className="safi-receipt__balance-amt safi-mono">KES {Math.round(o.total - o.paid).toLocaleString('en-KE')}</div>
            </div>
          )}

          <p className="safi-receipt__terms">
            {shop?.terms || 'Items uncollected after 30 days are donated. Claims must be made within 24 hrs of collection. Keep this receipt — required for pickup. Asante sana!'}
          </p>

          {(D.settings?.ownerPhone || D.settings?.payTo) && (
            <div className="safi-receipt__notice">
              {D.settings?.payTo && <div><b>Pay only to {D.settings.payTo}</b>{D.settings.payToName ? ` — ${D.settings.payToName}` : ''}. Never to a personal number.</div>}
              {D.settings?.ownerPhone && <div>No SMS from us within 10 minutes? Call {D.settings.ownerPhone}.</div>}
            </div>
          )}

          <div className="safi-receipt__foot">
            <b>{shop?.footerMsg || 'ASANTE — KARIBU TENA'}</b><br/>
            {shop?.web || 'vazisafi.co.ke'}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Customers ────────────────────────────────────────────────────────────
// Tier badge that doubles as a picker — e.g. a student who graduates becomes normal.
function TierCell({ customer, lang }) {
  const [open, setOpen] = useStateFD(false);
  const [pos, setPos] = useStateFD(null);
  const btnRef = useRefFD(null);
  const TIERS = ['normal', 'student', 'corporate'];
  // The table scrolls inside overflow:hidden ancestors, so the menu is fixed-
  // positioned off the button's rect and flips up when it would run off-screen.
  function toggle() {
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const H = 120;
    const up = r.bottom + H > window.innerHeight;
    setPos({ left: Math.min(r.left, window.innerWidth - 160), top: up ? r.top - H - 6 : r.bottom + 6 });
    setOpen(true);
  }
  return (
    <div className="safi-tiercell">
      <button ref={btnRef} className="safi-tiercell__btn" title="Change tier" onClick={toggle}>
        <GroupBadge group={customer.group}/>
        <Icon name="chevron-down" size={12}/>
      </button>
      {open && (
        <>
          <div className="safi-tiercell__scrim" onClick={() => setOpen(false)} onWheel={() => setOpen(false)}/>
          <div className="safi-tiercell__menu" style={{ left: pos.left, top: pos.top }}>
            {TIERS.map(g => (
              <button key={g} className={`safi-tiercell__opt ${g === customer.group ? 'is-active' : ''}`}
                onClick={() => {
                  setOpen(false);
                  if (g === customer.group) return;
                  window.SAFI_STORE.updateCustomer(customer.id, { group: g });
                  toast(`${customer.name} moved to ${t(g, lang)}`, 'success');
                }}>
                <GroupBadge group={g}/>
                {g === customer.group && <Icon name="check" size={13}/>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomersScreen({ lang, money, setView, role }) {
  const D = useStore();
  const [q, setQ] = useStateFD('');
  const [group, setGroup] = useStateFD('all');
  const [showAdd, setShowAdd] = useStateFD(false);
  const fileRef = useRefFD(null);

  const rows = D.customers.filter(c => {
    if (group !== 'all' && c.group !== group) return false;
    if (q && !(c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))) return false;
    return true;
  });

  function handleImport(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      const rows = parseCSV(text);
      if (!rows.length) { toast('No rows parsed', 'error'); return; }
      const added = window.SAFI_STORE.importCustomers(rows);
      toast(`Imported ${added} customers`, 'success');
    };
    reader.readAsText(file);
  }

  return (
    <>
      <Topbar
        title={t('nav_customers', lang)}
        subtitle={`${D.customers.length} customers · imported records saved locally`}
        right={<>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleImport(e.target.files[0]); e.target.value = ''; }}/>
          {role === 'owner' && <Button kind="ghost" icon="box" onClick={() => fileRef.current?.click()}>Import CSV</Button>}
          {role === 'owner' && <Button kind="ghost" icon="print" onClick={() => exportCustomersCSV(D.customers)}>Export CSV</Button>}
          <Button kind="primary" icon="plus" onClick={() => setShowAdd(true)}>{t('add_customer', lang)}</Button>
        </>}
      />

      <div className="safi-grid safi-grid--4">
        <StatCard label="Total customers" value={D.customers.length} icon="users"/>
        <StatCard label="Students" value={D.customers.filter(c => c.group === 'student').length}/>
        <StatCard label="Normal" value={D.customers.filter(c => c.group === 'normal').length}/>
        <StatCard label="Corporate accounts" value={D.customers.filter(c => c.group === 'corporate').length}/>
      </div>

      <Card pad={false}>
        <div className="safi-toolbar">
          <div className="safi-cust-pick__search safi-cust-pick__search--inline">
            <Icon name="search" size={16}/>
            <input placeholder="Search name or phone…" value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div className="safi-toolbar__filters">
            {['all', 'student', 'normal', 'corporate'].map(g => (
              <button key={g} className={`safi-chip ${group === g ? 'is-active' : ''}`} onClick={() => setGroup(g)}>{g === 'all' ? 'All' : t(g, lang)}</button>
            ))}
          </div>
        </div>
        <Table
          cols={[
            { label: 'Name', render: r => (
              <div className="safi-cell-cust">
                <span className="safi-cust-pick__avatar">{r.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
                <div><div className="safi-cell-strong">{r.name}</div><div className="safi-cell-sub">{r.phone}</div></div>
              </div>
            )},
            { label: 'Tier', render: r => <TierCell customer={r} lang={lang}/> },
            { label: 'Joined', render: r => <span className="safi-cell-sub">{r.joined}</span> },
            { label: 'Orders', render: r => <b>{r.orders}</b> },
            { label: 'Lifetime spend', render: r => <span className="safi-mono safi-cell-strong">{money(r.spend)}</span> },
            { label: 'Loyalty', render: r => (
              <div className="safi-loy">
                <div className="safi-loy__bar"><div style={{ width: `${r.loyalty * 10}%` }}/></div>
                <span>{r.loyalty}/10</span>
              </div>
            )},
            { label: 'Residence', render: r => r.location ? <span className="safi-cell-sub">{r.location}</span> : <span className="safi-cell-sub">—</span> },
          ]}
          rows={rows}
          empty="No customers yet — tap Add Customer or Import CSV."
        />
      </Card>

      <AddCustomerModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={() => setShowAdd(false)}/>
    </>
  );
}

// CSV helpers
function parseCSV(text) {
  // Tiny CSV parser supporting quoted fields
  function parseLine(line) {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else {
        if (ch === ',') { out.push(cur); cur = ''; }
        else if (ch === '"') q = true;
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map(c => c.trim());
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const header = parseLine(lines[0]).map(h => h.toLowerCase());
  const nameIdx     = header.findIndex(h => /name/.test(h));
  const prefixIdx   = header.findIndex(h => /prefix|country/.test(h));
  const phoneIdx    = header.findIndex(h => /phone|mobile|tel/.test(h));
  const groupIdx    = header.findIndex(h => /group|tier|category/.test(h));
  const locationIdx = header.findIndex(h => /location|address|area|estate/.test(h));
  const useHeader = nameIdx >= 0;
  const start = useHeader ? 1 : 0;
  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const r = useHeader
      ? {
          name: cells[nameIdx] || '',
          prefix: (cells[prefixIdx] || '+254').trim(),
          phone: cells[phoneIdx] || '',
          group: cells[groupIdx] || 'normal',
          location: locationIdx >= 0 ? cells[locationIdx] || '' : '',
        }
      : { name: cells[0] || '', prefix: '+254', phone: cells[1] || '', group: cells[2] || 'normal', location: cells[3] || '' };
    if (r.name) rows.push(r);
  }
  return rows;
}
function exportCustomersCSV(customers) {
  const csv = ['name,prefix,phone,group,location,joined,orders,spend',
    ...customers.map(c => [c.name, c.prefix || '+254', c.phone, c.group, c.location || '', c.joined, c.orders, c.spend]
      .map(v => /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : v).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `vazi-safi-customers-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Payments & Audit ─────────────────────────────────────────────────────
function PaymentsScreen({ lang, money, role }) {
  const D = useStore();
  const isManagement = role === 'owner';
  const [tab, setTab] = useStateFD('all');
  const [form, setForm] = useStateFD({ order: '', method: 'mpesa', amount: '', txn: '', date: new Date().toISOString().slice(0, 10) });

  const rows = D.payments.filter(p => tab === 'all' || p.method === tab);

  const totalsByMethod = ['mpesa', 'cash', 'bank'].map(m => ({
    m, total: D.payments.filter(p => p.method === m).reduce((s, p) => s + p.amount, 0),
    count: D.payments.filter(p => p.method === m).length,
  }));
  const unverifiedCount = D.payments.filter(p => !p.verified).length;

  function submit() {
    if (!form.order || !form.amount) { toast('Order # and amount required', 'error'); return; }
    const order = D.orders.find(o => o.id === form.order);
    if (!order) { toast(`Order ${form.order} not found`, 'error'); return; }
    const cust = D.customers.find(c => c.id === order.customer);
    window.SAFI_STORE.recordPayment({
      orderId: form.order, method: form.method,
      amount: parseFloat(form.amount), txn: form.txn,
      customer: cust?.name || 'Walk-in',
    });
    toast('Payment recorded', 'success');
    setForm({ order: '', method: 'mpesa', amount: '', txn: '', date: new Date().toISOString().slice(0, 10) });
  }

  return (
    <>
      <Topbar
        title={t('nav_payments', lang)}
        subtitle={isManagement
          ? "Verify staff entries against M-Pesa & bank statements. Reconciliation is a Management responsibility."
          : "Record payments and transaction codes. Management will verify them against statements."}
        right={<>
          {isManagement && <Button kind="ghost" icon="print" onClick={() => window.print()}>{t('print_summary', lang)}</Button>}
          {isManagement && <Button kind="primary" icon="check">Reconcile period</Button>}
        </>}
      />

      <div className="safi-grid safi-grid--4">
        {totalsByMethod.map(({ m, total, count }) => (
          <div key={m} className={`safi-stat safi-stat--method safi-stat--${m}`}>
            <div className="safi-stat__top">
              <div className="safi-stat__label">{m === 'mpesa' ? 'M-Pesa' : m === 'cash' ? 'Cash' : 'Bank transfer'}</div>
              <Icon name={m === 'mpesa' ? 'mpesa' : 'wallet'} size={16}/>
            </div>
            <div className="safi-stat__value">{money(total)}</div>
            <div className="safi-stat__delta">{count} transactions</div>
          </div>
        ))}
        <div className="safi-stat safi-stat--accent">
          <div className="safi-stat__top"><div className="safi-stat__label">Unverified</div><Icon name="alert" size={16}/></div>
          <div className="safi-stat__value">{unverifiedCount}</div>
          <div className="safi-stat__delta safi-stat__delta--down">{unverifiedCount === 0 ? 'All good' : 'Needs audit'}</div>
        </div>
      </div>

      <Card title={isManagement ? 'Enter / verify transaction code' : 'Add transaction code'} action={<span className="safi-cell-sub">For monthly audit · {isManagement ? 'verifies on save' : 'awaits Management verification'}</span>}>
        <div className="safi-txn-form">
          <div className="safi-txn-form__group">
            <label>Order #</label>
            <input className="safi-input safi-mono" placeholder="SF-2425" value={form.order} onChange={e => setForm({ ...form, order: e.target.value.toUpperCase() })}/>
          </div>
          <div className="safi-txn-form__group">
            <label>Method</label>
            <div className="safi-seg">
              {['mpesa', 'bank', 'cash'].map(m => <button key={m} className={`safi-seg__btn ${form.method === m ? 'is-active' : ''}`} onClick={() => setForm({ ...form, method: m })}>{m === 'mpesa' ? 'M-Pesa' : m === 'bank' ? 'Bank' : 'Cash'}</button>)}
            </div>
          </div>
          <div className="safi-txn-form__group">
            <label>Transaction code</label>
            <input className="safi-input safi-mono" placeholder="e.g. TGW8KL2M91" value={form.txn} onChange={e => setForm({ ...form, txn: e.target.value.toUpperCase() })}/>
          </div>
          <div className="safi-txn-form__group">
            <label>Amount</label>
            <input className="safi-input safi-mono" placeholder="2,280" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/>
          </div>
          <div className="safi-txn-form__group">
            <label>Date received</label>
            <input type="date" className="safi-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/>
          </div>
          <Button kind="primary" icon="check" onClick={submit}>{t('verify', lang)} & save</Button>
        </div>
      </Card>

      <Card pad={false} title="Transaction ledger" action={
        <div className="safi-tabs">
          {['all', 'mpesa', 'cash', 'bank'].map(x => (
            <button key={x} className={`safi-tabs__btn ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>{x === 'all' ? 'All' : x === 'mpesa' ? 'M-Pesa' : x === 'cash' ? 'Cash' : 'Bank'}</button>
          ))}
        </div>
      }>
        <Table
          cols={[
            { label: 'Date', render: r => <span className="safi-cell-sub">{r.date.slice(5)}</span> },
            { label: 'Order #', render: r => <span className="safi-mono safi-cell-strong">{r.order}</span> },
            { label: 'Customer', render: r => r.customer || '—' },
            { label: 'Method', render: r => <MethodBadge method={r.method}/> },
            { label: 'Amount', render: r => <span className="safi-mono safi-cell-strong">{money(r.amount)}</span> },
            { label: 'Txn code', render: r => r.txn ? <span className="safi-mono">{r.txn}</span> : <span className="safi-cell-sub">—</span> },
            { label: 'Status', render: r => r.verified ? <span className="safi-pill safi-pill--green"><Icon name="check" size={10}/> {t('verified', lang)}</span> : <span className="safi-pill safi-pill--amber">⚠ {t('unverified', lang)}</span> },
            { label: '', render: r => r.verified
                ? <span className="safi-cell-sub">—</span>
                : (isManagement
                    ? <button className="safi-rowlink" onClick={() => { window.SAFI_STORE.verifyPayment(r.id); toast('Verified'); }}>{t('verify', lang)} →</button>
                    : <span className="safi-cell-sub" title="Only Management can verify payments">🔒 Mgmt</span>) },
          ]}
          rows={rows}
          empty="No payments yet."
        />
      </Card>
    </>
  );
}

// ─── Packages & Discounts ─────────────────────────────────────────────────
function PackagesScreen({ lang, money }) {
  const D = useStore();
  const [showAdd, setShowAdd] = useStateFD(false);
  const [pkg, setPkg] = useStateFD({ name: '', target: 'normal', period: 'month', price: '', includes: '' });

  function submit() {
    if (!pkg.name || !pkg.price) { toast('Name and price required', 'error'); return; }
    window.SAFI_STORE.addPackage({ ...pkg, price: parseFloat(pkg.price) });
    toast(`${pkg.name} added`, 'success');
    setPkg({ name: '', target: 'normal', period: 'month', price: '', includes: '' });
    setShowAdd(false);
  }

  return (
    <>
      <Topbar
        title={t('nav_packages', lang)}
        subtitle="Subscription bundles for students, families, and corporate clients."
        right={<>
          <Button kind="primary" icon="plus" onClick={() => setShowAdd(true)}>New package</Button>
        </>}
      />

      <div className="safi-grid safi-grid--3">
        {D.packages.map(p => (
          <div key={p.id} className={`safi-pkg ${!p.active ? 'is-inactive' : ''}`}>
            <div className="safi-pkg__hd">
              <span className={`safi-pkg__period safi-pkg__period--${p.period}`}>{p.period.toUpperCase()}</span>
              <GroupBadge group={p.target}/>
            </div>
            <h3 className="safi-pkg__name">{p.name}</h3>
            <div className="safi-pkg__price"><span className="safi-mono">{money(p.price)}</span><span className="safi-pkg__per">/ {p.period}</span></div>
            <p className="safi-pkg__inc">{p.includes}</p>
            <div className="safi-pkg__foot">
              <span>{p.subscribers || 0} subscribers</span>
              <button className="safi-pkg__edit" onClick={() => window.SAFI_STORE.addPackage({ ...p, active: !p.active })}>{p.active ? 'Pause →' : 'Activate →'}</button>
            </div>
          </div>
        ))}
        <div className="safi-pkg safi-pkg--add" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={28}/>
          <span>Create a new package</span>
          <p>Bundle services for repeat customers — monthly, weekly, or one-off.</p>
        </div>
      </div>

      <Card title="Active discount codes">
        <Table
          cols={[
            { label: 'Name', render: r => <b>{r.name}</b> },
            { label: 'Code', render: r => <span className="safi-mono safi-tag safi-tag--blue">{r.code}</span> },
            { label: 'Value', render: r => <b>{r.type === 'pct' ? `-${r.value}%` : `-${money(r.value)}`}</b> },
            { label: 'Expires', render: r => r.expires },
            { label: 'Times used', render: r => r.uses || 0 },
          ]}
          rows={D.discounts}
          empty="No discounts."
        />
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New package"
        footer={<>
          <Button kind="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={submit}>Create package</Button>
        </>}>
        <div className="safi-form">
          <label>Name<input className="safi-input" value={pkg.name} onChange={e => setPkg({ ...pkg, name: e.target.value })} placeholder="e.g. Hostel Weekly"/></label>
          <label>Target tier
            <div className="safi-seg">
              {['student', 'normal', 'corporate'].map(g => (
                <button key={g} className={`safi-seg__btn ${pkg.target === g ? 'is-active' : ''}`} onClick={() => setPkg({ ...pkg, target: g })}>{g[0].toUpperCase() + g.slice(1)}</button>
              ))}
            </div>
          </label>
          <label>Period
            <div className="safi-seg">
              {['week', 'month'].map(p => (
                <button key={p} className={`safi-seg__btn ${pkg.period === p ? 'is-active' : ''}`} onClick={() => setPkg({ ...pkg, period: p })}>{p[0].toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
          </label>
          <label>Price (KES)<input type="number" className="safi-input safi-mono" value={pkg.price} onChange={e => setPkg({ ...pkg, price: e.target.value })}/></label>
          <label>What's included<input className="safi-input" value={pkg.includes} onChange={e => setPkg({ ...pkg, includes: e.target.value })} placeholder="e.g. 15 kg wash & fold"/></label>
        </div>
      </Modal>
    </>
  );
}

// ─── Issues board ─────────────────────────────────────────────────────────
function IssuesScreen({ lang }) {
  const D = useStore();
  const [tab, setTab] = useStateFD('all');
  const [form, setForm] = useStateFD({ subject: '', order: '', priority: 'medium', details: '' });

  const rows = D.issues.filter(i => tab === 'all' || i.status === tab);
  const counts = ['open', 'in-review', 'resolved'].map(s => ({ s, n: D.issues.filter(i => i.status === s).length }));

  function submit() {
    if (!form.subject.trim()) { toast('Subject required', 'error'); return; }
    window.SAFI_STORE.addIssue(form);
    toast('Issue raised', 'success');
    setForm({ subject: '', order: '', priority: 'medium', details: '' });
  }

  return (
    <>
      <Topbar
        title={t('nav_issues', lang)}
        subtitle="Raise & track problems — customer complaints, equipment, missing items."
      />

      <div className="safi-grid safi-grid--3">
        {counts.map(({ s, n }) => (
          <div key={s} className={`safi-stat safi-stat--issue safi-stat--${s}`}>
            <div className="safi-stat__label">{s.replace('-', ' ')}</div>
            <div className="safi-stat__value">{n}</div>
          </div>
        ))}
      </div>

      <Card title="Raise an issue">
        <div className="safi-issue-form">
          <div className="safi-issue-form__group safi-issue-form__group--wide">
            <label>{t('subject', lang)}</label>
            <input className="safi-input" placeholder="What happened?" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}/>
          </div>
          <div className="safi-issue-form__group">
            <label>Related order (optional)</label>
            <input className="safi-input safi-mono" placeholder="SF-2425" value={form.order} onChange={e => setForm({ ...form, order: e.target.value.toUpperCase() })}/>
          </div>
          <div className="safi-issue-form__group">
            <label>{t('priority', lang)}</label>
            <div className="safi-seg">
              {['low', 'medium', 'high'].map(p => (
                <button key={p} className={`safi-seg__btn ${form.priority === p ? 'is-active' : ''}`} onClick={() => setForm({ ...form, priority: p })}>{p[0].toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className="safi-issue-form__group safi-issue-form__group--wide">
            <label>Details</label>
            <textarea className="safi-textarea" placeholder="Describe the issue, expected outcome, customer reaction…" value={form.details} onChange={e => setForm({ ...form, details: e.target.value })}/>
          </div>
          <Button kind="primary" icon="alert" onClick={submit}>Submit issue</Button>
        </div>
      </Card>

      <Card pad={false} title="All issues" action={
        <div className="safi-tabs">
          {['all', 'open', 'in-review', 'resolved'].map(x => (
            <button key={x} className={`safi-tabs__btn ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>{x === 'all' ? 'All' : x}</button>
          ))}
        </div>
      }>
        <Table
          cols={[
            { label: 'Date', render: r => <span className="safi-cell-sub">{r.date.slice(5)}</span> },
            { label: 'Subject', render: r => <b>{r.subject}</b> },
            { label: 'Raised by', render: r => r.raisedBy },
            { label: 'Order', render: r => r.order ? <span className="safi-mono">{r.order}</span> : <span className="safi-cell-sub">—</span> },
            { label: 'Priority', render: r => <span className={`safi-tag safi-tag--${r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'amber' : 'gray'}`}>{r.priority}</span> },
            { label: 'Status', render: r => <span className={`safi-pill safi-pill--${r.status === 'open' ? 'red' : r.status === 'in-review' ? 'amber' : 'green'}`}><span className="safi-pill__dot"/>{r.status}</span> },
            { label: '', render: r => (
              <select className="safi-mini-select" value={r.status} onChange={e => { window.SAFI_STORE.updateIssue(r.id, { status: e.target.value }); toast('Status updated'); }}>
                <option value="open">Open</option>
                <option value="in-review">In review</option>
                <option value="resolved">Resolved</option>
              </select>
            )},
          ]}
          rows={rows}
          empty="No issues raised."
        />
      </Card>
    </>
  );
}

// ─── Shift open / close ────────────────────────────────────────
// Counting the drawer at a known moment is what makes cash checkable at all. Framed as
// handover, because that is what it is — the attendant signs for the float and signs it
// back out. The comparison against expected happens out of sight.
function ShiftModal({ open, onClose, money }) {
  const D = useStore();
  const sh = window.SAFI_STORE.getOpenShift();
  const [float_, setFloat] = useStateFD(0);
  const [counted, setCounted] = useStateFD('');
  const [note, setNote] = useStateFD('');

  useEffectFD(() => { if (open) { setFloat(0); setCounted(''); setNote(''); } }, [open]);

  const staff = window.SAFI_STORE.getCurrentStaff();

  if (sh) {
    return (
      <Modal open={open} onClose={onClose} title="Close shift" width={420}
        footer={<>
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button kind="primary" icon="check" disabled={counted === ''} onClick={() => {
            window.SAFI_STORE.closeShift({ declaredCash: Number(counted) || 0, note });
            toast('Shift closed', 'success');
            onClose();
          }}>Close shift</Button>
        </>}>
        <div className="safi-form">
          <div className="safi-mini-cust__row"><span>Attendant</span><b>{(D.staff.find(s => s.id === sh.staff) || staff).name}</b></div>
          <div className="safi-mini-cust__row"><span>Opened</span><b>{sh.openedAtLabel}</b></div>
          <div className="safi-mini-cust__row"><span>Opening float</span><b className="safi-mono">{money(sh.openingFloat)}</b></div>
          <label>Cash counted in the drawer now
            <input className="safi-input safi-mono" inputMode="numeric" value={counted} placeholder="0"
              autoFocus onChange={e => setCounted(e.target.value.replace(/[^\d]/g, ''))}/>
          </label>
          <label>Note (optional)
            <input className="safi-input" value={note} placeholder="Anything unusual today"
              onChange={e => setNote(e.target.value)}/>
          </label>
          <p className="safi-hint">Count the notes and coins and enter the figure. Do not work it out from the orders.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Open shift" width={400}
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" icon="check" onClick={() => {
          window.SAFI_STORE.openShift({ openingFloat: Number(float_) || 0 });
          toast('Shift open — karibu', 'success');
          onClose();
        }}>Open shift</Button>
      </>}>
      <div className="safi-form">
        <div className="safi-mini-cust__row"><span>Attendant</span><b>{staff.name}</b></div>
        <label>Opening float in the drawer
          <input className="safi-input safi-mono" inputMode="numeric" value={float_} autoFocus
            onChange={e => setFloat(e.target.value.replace(/[^\d]/g, ''))}/>
        </label>
        <p className="safi-hint">Count the float before the first customer. You will count again at close.</p>
      </div>
    </Modal>
  );
}

Object.assign(window, { FrontDeskDashboard, NewOrder, OrdersQueue, OrderDetail, Receipt, CustomersScreen, PaymentsScreen, PackagesScreen, IssuesScreen, AddCustomerModal, PaymentModal, ShiftModal });
