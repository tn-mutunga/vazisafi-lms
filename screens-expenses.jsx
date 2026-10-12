// Vazi Safi — Expenses (front-desk add + management view)
const { useState: useStateEx, useRef: useRefEx } = React;

// ─── Expenses screen (works for both Front Desk + Management) ─────────────
// Colour + icon per expense category, picked from the name so every laptop agrees.
// Saved chip order (synced). Missing ids keep their natural place at the end.
function orderedCats(D) {
  const ord = (D.settings && D.settings.expenseCatOrder) || [];
  const pos = (id) => { const i = ord.indexOf(id); return i < 0 ? 1e6 : i; };
  return [...(D.expenseCategories || [])].map((c, i) => ({ c, i })).sort((a, b) => (pos(a.c.id) - pos(b.c.id)) || (a.i - b.i)).map(x => x.c);
}
const isOtherCat = (c) => !!c && /^other$/i.test(String(c.name || '').trim());
// "Other" has no fixed group: each Other expense picks Operational or Special (settings.expenseGroupOverrides).
function costGroupOf(D, ex) {
  const cat = (D.expenseCategories || []).find(c => c.id === ex.category);
  const ov = (D.settings && D.settings.expenseGroupOverrides) || {};
  if (isOtherCat(cat)) return ov[ex.id] === 'special' ? 'special' : 'operational';
  const g = (D.settings && D.settings.expenseGroups) || {};
  return g[ex.category] === 'special' ? 'special' : 'operational';
}
function setExpenseGroup(D, id, g) {
  const ov = { ...((D.settings && D.settings.expenseGroupOverrides) || {}) };
  if (g === 'special') ov[id] = 'special'; else delete ov[id];
  window.SAFI_STORE.setSetting('expenseGroupOverrides', ov);
}

const splitIds = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
const joinIds = (a) => [...new Set(a)].join(', ');

// Linked orders (many) with autocomplete. Picking an order also adds its customer.
function LinkedOrdersField({ D, form, setForm, required }) {
  const [q, setQ] = useStateEx('');
  const [open, setOpen] = useStateEx(false);
  const orders = splitIds(form.linkedOrder);
  const custs = splitIds(form.linkedCustomer);
  const cname = (id) => (D.customers.find(c => c.id === id) || {}).name || id;
  const qq = q.trim().toUpperCase().replace(/^SF-?/, '');
  const hits = !qq ? [] : D.orders.filter(o => !orders.includes(o.id) && (
      orderNo(o.id).toUpperCase().replace(/^SF-?/, '').startsWith(qq) ||
      (cname(o.customer) || '').toUpperCase().includes(q.trim().toUpperCase())
    )).slice(0, 8);
  const addOrder = (o) => {
    const nextC = o.customer && !custs.includes(o.customer) ? [...custs, o.customer] : custs;
    setForm({ ...form, linkedOrder: joinIds([...orders, o.id]), linkedCustomer: joinIds(nextC) });
    setQ(''); setOpen(false);
  };
  const removeOrder = (id) => {
    const o = D.orders.find(x => x.id === id);
    const left = orders.filter(x => x !== id);
    const stillUsed = (cid) => left.some(lid => (D.orders.find(x => x.id === lid) || {}).customer === cid);
    const nextC = o && o.customer && !stillUsed(o.customer) ? custs.filter(c => c !== o.customer) : custs;
    setForm({ ...form, linkedOrder: joinIds(left), linkedCustomer: joinIds(nextC) });
  };
  return (
    <div className="safi-form__row">
      <label>Linked orders {required ? <span className="safi-req-inline">required</span> : '(optional)'}
        <div className="safi-multi">
          {orders.map(id => <span key={id} className="safi-multi__chip safi-mono">{orderNo(id)}<button type="button" onClick={() => removeOrder(id)}>×</button></span>)}
          <input className="safi-multi__input safi-mono" value={q} placeholder={orders.length ? 'Add another…' : 'Type order no. e.g. 2419'}
            onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={e => { if (e.key === 'Enter' && hits[0]) { e.preventDefault(); addOrder(hits[0]); } if (e.key === 'Backspace' && !q && orders.length) removeOrder(orders[orders.length - 1]); }}/>
          {open && hits.length > 0 && (
            <div className="safi-multi__menu">
              {hits.map(o => <button type="button" key={o.id} onMouseDown={() => addOrder(o)}><b className="safi-mono">{orderNo(o.id)}</b><span>{cname(o.customer)}</span><span className="safi-cell-sub">{String(o.in || '').slice(5, 10)}</span></button>)}
            </div>
          )}
        </div>
      </label>
      <label>Linked customers (optional)
        <div className="safi-multi">
          {custs.map(id => <span key={id} className="safi-multi__chip">{cname(id)}<button type="button" onClick={() => setForm({ ...form, linkedCustomer: joinIds(custs.filter(c => c !== id)) })}>×</button></span>)}
          <select className="safi-multi__input" value="" onChange={e => { if (e.target.value) setForm({ ...form, linkedCustomer: joinIds([...custs, e.target.value]) }); }}>
            <option value="">{custs.length ? 'Add another…' : 'Filled from orders, or pick'}</option>
            {[...D.customers].filter(c => !custs.includes(c.id)).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </label>
    </div>
  );
}

function catLook(name) {
  const n = String(name || '').toLowerCase();
  const L = [[/bike/, '#6366f1', 'rider'], [/licen|permit/, '#0f766e', 'tag'], [/labou?r/, '#a16207', 'wrench'], [/airtime|internet|phone/, '#06b6d4', 'phone'], [/detergent|chemical|suppl/, '#3DAEE9', 'wash'], [/outsourc|dry/, '#8b5cf6', 'dry'], [/electric|water|power|kplc/, '#f59e0b', 'electric'],
    [/salar|wage|staff/, '#10b981', 'staff'], [/rent/, '#64748b', 'home'], [/repair|equip|mainten/, '#ef4444', 'wrench'],
    [/transport|deliver|fuel/, '#14b8a6', 'truck'], [/packag|bag/, '#E87722', 'bag'], [/market|advert/, '#ec4899', 'sms'], [/bike/, '#6366f1', 'rider']];
  for (const [re, c, i] of L) if (re.test(n)) return { c, i };
  return { c: '#9ca3af', i: 'package' };
}

// Two cost groups. Each category is Operational (default) or Special; drag chips
// between the two boxes. Stored in synced settings.expenseGroups { catId: 'special' }.
function CostGroups({ D, money, periodCutoff, period }) {
  const [over, setOver] = useStateEx('');
  const groups = (D.settings && D.settings.expenseGroups) || {};
  const groupOf = (id) => groups[id] === 'special' ? 'special' : 'operational';
  const setGroup = (id, g) => { if (!id || isOtherCat(D.expenseCategories.find(c => c.id === id)) || groupOf(id) === g) return; window.SAFI_STORE.setSetting('expenseGroups', { ...groups, [id]: g }); const c = D.expenseCategories.find(x => x.id === id); toast(`${c ? c.name : 'Category'} → ${g === 'special' ? 'Special' : 'Operational'}`); };
  const inP = (d) => !periodCutoff || String(d || '').slice(0, 10) >= periodCutoff;
  const revenue = D.orders.filter(o => inP(o.in)).reduce((s, o) => s + (o.total || 0), 0);
  const exp = D.expenses.filter(x => inP(x.date));
  const sumG = (g) => exp.filter(x => costGroupOf(D, x) === g).reduce((s, x) => s + (x.amount || 0), 0);
  const otherIn = (g) => exp.filter(x => isOtherCat(D.expenseCategories.find(c => c.id === x.category)) && costGroupOf(D, x) === g).reduce((s, x) => s + (x.amount || 0), 0);
  const opCost = sumG('operational'), spCost = sumG('special');
  const opProfit = revenue - opCost, net = opProfit - spCost;
  const box = (g, title) => {
    const cats = orderedCats(D).filter(c => !isOtherCat(c) && groupOf(c.id) === g);
    return (
      <div className={`safi-costgrp ${over === g ? 'is-over' : ''}`}
        onDragOver={ev => { ev.preventDefault(); setOver(g); }} onDragLeave={() => setOver('')}
        onDrop={ev => { ev.preventDefault(); setOver(''); setGroup(ev.dataTransfer.getData('text/safi-cat'), g); }}>
        <div className="safi-costgrp__hd"><b>{title}</b><span className="safi-mono">{money(g === 'special' ? spCost : opCost)}</span></div>
        <div className="safi-costgrp__chips">
          {cats.map(c => { const k = catLook(c.name); return (
            <span key={c.id} className="safi-catchip" style={{ '--c': k.c }} draggable onDragStart={ev => ev.dataTransfer.setData('text/safi-cat', c.id)}><Icon name={k.i} size={13}/>{c.name}</span>
          ); })}
          {!cats.length && <span className="safi-cell-sub">Drag categories here</span>}
          {otherIn(g) > 0 && <span className="safi-catchip" style={{ '--c': '#9ca3af', cursor: 'default' }} title="Other is chosen per expense"><Icon name="package" size={13}/>Other · {money(otherIn(g))}</span>}
        </div>
      </div>
    );
  };
  const lbl = { today: 'today', week: 'last 7 days', month: 'last 30 days', all: 'all time' }[period] || '';
  return (
    <Card title={`Profit by cost group · ${lbl}`} action={<span className="safi-cell-sub">Drag a category chip into a box to move it</span>}>
      <div className="safi-costgrps">{box('operational', 'Operational expenses')}{box('special', 'Special expenses')}</div>
      <div className="safi-profitline">
        <div><span>Revenue</span><b className="safi-mono">{money(revenue)}</b></div>
        <div><span>− Operational</span><b className="safi-mono">{money(opCost)}</b></div>
        <div className="is-sub"><span>Operating profit</span><b className={`safi-mono ${opProfit < 0 ? 'is-neg' : ''}`}>{money(opProfit)}</b></div>
        <div><span>− Special</span><b className="safi-mono">{money(spCost)}</b></div>
        <div className="is-total"><span>Net profit</span><b className={`safi-mono ${net < 0 ? 'is-neg' : ''}`}>{money(net)}</b></div>
      </div>
    </Card>
  );
}

function ExpensesScreen({ lang, money, role }) {
  const D = useStore();
  const [showAdd, setShowAdd]   = useStateEx(false);
  const [editId, setEditId]     = useStateEx(null);
  const [showCats, setShowCats] = useStateEx(false);
  const [period, setPeriod]     = useStateEx('all');
  const [catFilter, setCatFilter] = useStateEx('all');
  const [form, setForm]         = useStateEx({ category: D.expenseCategories[0]?.id, label: '', amount: '', method: 'mpesa', txn: '', notes: '', linkedOrder: '', linkedCustomer: '' });
  const isManagement = role === 'owner';
  const [dragOver, setDragOver] = useStateEx('');
  const [txnErr, setTxnErr] = useStateEx(false);

  // Filter
  const todayStr = SAFI_TIME.day();
  const periodCutoff = period === 'today'
    ? todayStr
    : period === 'week'
      ? SAFI_TIME.day(new Date(Date.now() - 7 * 86400e3))
      : period === 'month'
        ? SAFI_TIME.day(new Date(Date.now() - 30 * 86400e3))
        : null;
  const filtered = D.expenses.filter(e => {
    if (periodCutoff && e.date.slice(0, 10) < periodCutoff) return false;
    if (catFilter !== 'all' && e.category !== catFilter) return false;
    return true;
  }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const totalAll = filtered.reduce((s, e) => s + e.amount, 0);
  const byCat = D.expenseCategories.map(c => ({
    ...c,
    total: filtered.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0),
    count: filtered.filter(e => e.category === c.id).length,
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  function submit() {
    if (!form.label.trim() || !form.amount) { toast('Description and amount required', 'error'); return; }
    if (form.method !== 'cash' && String(form.txn || '').trim().length < 5) { setTxnErr(true); toast('Transaction code needs at least 5 characters (ideally the last 5)', 'error'); return; }
    if (isOutsourced(form.category) && !splitIds(form.linkedOrder).length) { toast('Outsourced dry cleaning needs at least one linked order', 'error'); return; }
    if (editId) {
      window.SAFI_STORE.updateExpense(editId, { ...form, amount: parseFloat(form.amount) });
      if (isOtherCat(D.expenseCategories.find(c => c.id === form.category))) setExpenseGroup(D, editId, form.costGroup);
      toast('Expense updated', 'success');
    } else {
      const made = window.SAFI_STORE.addExpense({ ...form, amount: parseFloat(form.amount), paidBy: isManagement ? 'management' : undefined });
      if (made && form.costGroup === 'special' && isOtherCat(D.expenseCategories.find(c => c.id === form.category))) setExpenseGroup(D, made.id, 'special');
      toast('Expense logged', 'success');
    }
    setShowAdd(false); setEditId(null);
    setForm({ category: D.expenseCategories[0]?.id, label: '', amount: '', method: 'mpesa', txn: '', notes: '', linkedOrder: '', linkedCustomer: '' });
  }
  function openEdit(e) {
    setEditId(e.id);
    setForm({ category: e.category, label: e.label, amount: e.amount, method: e.method, txn: e.txn, notes: e.notes, linkedOrder: e.linkedOrder || '', linkedCustomer: e.linkedCustomer || '', costGroup: costGroupOf(D, e) });
    setShowAdd(true);
  }
  function openAdd() {
    setEditId(null);
    setForm({ category: D.expenseCategories[0]?.id, label: '', amount: '', method: 'mpesa', txn: '', notes: '', linkedOrder: '', linkedCustomer: '' });
    setShowAdd(true);
  }

  // Detect "outsourced" category for hinting
  const isOutsourced = (catId) => {
    const c = D.expenseCategories.find(x => x.id === catId);
    return c && /outsourc/i.test(c.name);
  };

  return (
    <>
      <Topbar
        title={t('nav_expenses', lang)}
        subtitle={isManagement
          ? "Track every shilling spent — detergent, outsourced services, bills, repairs."
          : "Log money paid out — supplies, electricity bills, transport, anything spent on behalf of the shop."}
        right={<>
          {isManagement && <Button kind="ghost" icon="tag" onClick={() => setShowCats(true)}>Manage categories</Button>}
          {isManagement && <Button kind="ghost" icon="print" onClick={() => exportExpensesCSV(filtered, D.expenseCategories)}>Export CSV</Button>}
          <Button kind="primary" icon="plus" onClick={openAdd}>Log expense</Button>
        </>}
      />

      <div className="safi-grid safi-grid--4">
        <StatCard label="Total expenses" value={money(totalAll)} icon="wallet"/>
        <StatCard label="Transactions" value={filtered.length} icon="list"/>
        <StatCard label="Top category" value={byCat[0]?.name || '—'} icon="tag"/>
        <StatCard label="This period" value={period === 'all' ? 'All time' : period[0].toUpperCase() + period.slice(1)} icon="clock"/>
      </div>

      <div className="safi-toolbar" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' }}>
        <div className="safi-seg">
          {[['today', 'Today'], ['week', '7 days'], ['month', '30 days'], ['all', 'All']].map(([k, lbl]) => (
            <button key={k} className={`safi-seg__btn ${period === k ? 'is-active' : ''}`} onClick={() => setPeriod(k)}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className="safi-catchips">
        <button className={`safi-catchip ${catFilter === 'all' ? 'is-active' : ''}`} style={{ '--c': 'var(--brand)' }} onClick={() => setCatFilter('all')}><Icon name="list" size={14}/>All categories</button>
        {orderedCats(D).map(c => { const k = catLook(c.name); return (
          <button key={c.id} className={`safi-catchip ${catFilter === c.id ? 'is-active' : ''} ${dragOver === c.id ? 'is-dropping' : ''}`} style={{ '--c': k.c }} onClick={() => setCatFilter(c.id)}
            draggable={isManagement} onDragStart={ev => { ev.dataTransfer.setData('text/safi-cat', c.id); ev.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={ev => { if (!isManagement) return; ev.preventDefault(); setDragOver(c.id); }} onDragLeave={() => setDragOver('')}
            onDrop={ev => { ev.preventDefault(); setDragOver(''); const from = ev.dataTransfer.getData('text/safi-cat'); if (!from || from === c.id) return; const ids = orderedCats(D).map(x => x.id).filter(x => x !== from); ids.splice(ids.indexOf(c.id), 0, from); window.SAFI_STORE.setSetting('expenseCatOrder', ids); }}><Icon name={k.i} size={14}/>{c.name}</button>
        ); })}
      </div>

      {isManagement && <CostGroups D={D} money={money} periodCutoff={periodCutoff} period={period}/>}

      {isManagement && byCat.length > 0 && (
        <Card title="Spend by category">
          <HBar data={byCat.map(c => ({ label: c.name, value: c.total }))}/>
        </Card>
      )}

      <Card pad={false} title="All expenses">
        <Table
          cols={[
            { label: 'Date', render: r => <span className="safi-cell-sub">{r.date.slice(5, 16)}</span> },
            { label: 'Category', render: r => {
              const c = D.expenseCategories.find(x => x.id === r.category);
              return <span className={`safi-tag safi-tag--${c?.color || 'gray'}`}>{c?.name || 'Unknown'}</span>;
            }},
            { label: 'Description', render: r => <div><b>{r.label}</b>{r.notes && <div className="safi-cell-sub">{r.notes}</div>}</div> },
            { label: 'Amount', render: r => <span className="safi-mono safi-cell-strong">— {money(r.amount)}</span> },
            { label: 'Method', render: r => <MethodBadge method={r.method}/> },
            { label: 'Txn', render: r => r.txn ? <span className="safi-mono safi-cell-sub">{r.txn}</span> : <span className="safi-cell-sub">—</span> },
            { label: 'Recorded by', render: r => {
              if (r.paidBy === 'management') return <span className="safi-tag safi-tag--violet">Management</span>;
              const s = D.staff.find(x => x.id === r.paidBy);
              return <span className="safi-cell-sub">{s?.name || '—'}</span>;
            }},
            { label: 'Linked', render: r => splitIds(r.linkedOrder).length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{splitIds(r.linkedOrder).map(id => <span key={id} className="safi-mono safi-tag safi-tag--blue">{orderNo(id)}</span>)}</div> : <span className="safi-cell-sub">—</span> },
            { label: '', render: r => (
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="safi-rowlink" onClick={() => openEdit(r)}>Edit</button>
                {isManagement && <button className="safi-rowlink safi-rowlink--danger" onClick={() => { if (confirm(`Delete "${r.label}"?`)) { window.SAFI_STORE.removeExpense(r.id); toast('Expense deleted'); } }}>Delete</button>}
              </div>
            )},
          ]}
          rows={filtered}
          empty="No expenses logged in this period. Tap Log Expense to start."
        />
      </Card>

      {/* Add / edit modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setEditId(null); }} title={editId ? 'Edit expense' : 'Log expense'} width={520}
        footer={<>
          <Button kind="ghost" onClick={() => { setShowAdd(false); setEditId(null); }}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={submit}>{editId ? 'Save changes' : 'Log expense'}</Button>
        </>}>
        <div className="safi-form">
          <label>Category
            <div className="safi-cat-pick">
              {orderedCats(D).map(c => (
                <button key={c.id} className={`safi-cat-pick__btn safi-cat-pick__btn--${c.color} ${form.category === c.id ? 'is-active' : ''}`} onClick={() => setForm({ ...form, category: c.id })}>
                  <Icon name={c.icon} size={16}/>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </label>
          {isOtherCat(D.expenseCategories.find(c => c.id === form.category)) && (
            <label>This "Other" cost counts as
              <div className="safi-seg">
                {[['operational', 'Operational expense'], ['special', 'Special expense']].map(([k, l]) => (
                  <button key={k} type="button" className={`safi-seg__btn ${(form.costGroup || 'operational') === k ? 'is-active' : ''}`} onClick={() => setForm({ ...form, costGroup: k })}>{l}</button>
                ))}
              </div>
            </label>
          )}
          <label>What was bought / paid for<input className="safi-input" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Persil 5kg x 2 tubs"/></label>
          <div className="safi-form__row">
            <label>Amount (KES)<input type="number" className="safi-input safi-mono" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></label>
            <label>Payment method
              <div className="safi-seg">
                {['mpesa', 'bank'].map(m => (
                  <button key={m} className={`safi-seg__btn ${form.method === m ? 'is-active' : ''}`} onClick={() => setForm({ ...form, method: m })}>{m === 'mpesa' ? 'M-Pesa' : 'Bank'}</button>
                ))}
              </div>
            </label>
          </div>
          {form.method === 'cash' ? (
            <p className="safi-hint">This older expense was paid in cash. Pick M-Pesa or Bank to change it.</p>
          ) : (
            <label>Transaction code (min. 5 characters)
              <input className={`safi-input safi-mono ${txnErr ? 'is-error' : ''}`} maxLength={20} value={form.txn}
                onChange={e => { setTxnErr(false); setForm({ ...form, txn: e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 20) }); }}
                placeholder="Last 5, e.g. KL2M9 (or full code)"/>
              <span className={`safi-hint ${txnErr || (form.txn && form.txn.length < 5) ? 'safi-hint--err' : ''}`}>
                {form.txn && form.txn.length < 5 ? `Expecting at least 5 characters (${form.txn.length} entered)` : 'At least 5 characters. Ideally the last 5; the full code is fine too.'}
              </span>
            </label>
          )}

          {isOutsourced(form.category) && (
            <div className="safi-callout">
              <Icon name="alert" size={14}/>
              <span>Outsourced dry cleaning — please link the order so revenue and cost match up.</span>
            </div>
          )}

          <LinkedOrdersField D={D} form={form} setForm={setForm} required={isOutsourced(form.category)}/>
          <label>Notes (optional)<textarea className="safi-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any additional context for the books"/></label>
        </div>
      </Modal>

      <CategoryManager open={showCats} onClose={() => setShowCats(false)}/>
    </>
  );
}

// ─── Manage categories (Management only) ──────────────────────────────────
function CategoryManager({ open, onClose }) {
  const D = useStore();
  const [name, setName]   = useStateEx('');
  const [color, setColor] = useStateEx('blue');
  const [icon, setIcon]   = useStateEx('package');

  function add() {
    if (!name.trim()) { toast('Name required', 'error'); return; }
    window.SAFI_STORE.addExpenseCategory({ name: name.trim(), color, icon });
    setName('');
    toast('Category added', 'success');
  }

  const colors = ['blue', 'green', 'amber', 'red', 'violet', 'gray'];
  const icons  = ['box', 'tag', 'wash', 'iron', 'shoe', 'staff', 'alert', 'arrow', 'package'];

  return (
    <Modal open={open} onClose={onClose} title="Manage expense categories" width={560}
      footer={<Button kind="primary" onClick={onClose}>Done</Button>}>
      <div className="safi-form">
        <h4 style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Existing categories</h4>
        <ul className="safi-cat-list">
          {D.expenseCategories.map(c => (
            <li key={c.id}>
              <span className={`safi-tag safi-tag--${c.color}`}><Icon name={c.icon} size={12}/> &nbsp;{c.name}</span>
              <button className="safi-rowlink safi-rowlink--danger" onClick={() => { if (confirm(`Delete "${c.name}"? Existing expenses keep this category as ID.`)) { window.SAFI_STORE.removeExpenseCategory(c.id); toast('Removed'); } }}>Delete</button>
            </li>
          ))}
        </ul>
        <h4 style={{ margin: '14px 0 4px', fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Add new category</h4>
        <label>Name<input className="safi-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Internet & airtime"/></label>
        <label>Color
          <div className="safi-color-pick">
            {colors.map(c => <button key={c} className={`safi-color-pick__btn safi-tag--${c} ${color === c ? 'is-active' : ''}`} onClick={() => setColor(c)}>{c}</button>)}
          </div>
        </label>
        <label>Icon
          <IconPicker value={icon} onChange={setIcon}/>
        </label>
        <Button kind="secondary" icon="plus" onClick={add}>Add category</Button>
      </div>
    </Modal>
  );
}

function exportExpensesCSV(expenses, cats) {
  const csv = ['date,category,description,amount,method,txn,notes',
    ...expenses.map(e => {
      const cn = cats.find(c => c.id === e.category)?.name || 'Unknown';
      return [e.date, cn, `"${(e.label || '').replace(/"/g, '""')}"`, e.amount, e.method, e.txn, `"${(e.notes || '').replace(/"/g, '""')}"`].join(',');
    })
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `vazi-safi-expenses-${SAFI_TIME.day()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

Object.assign(window, { ExpensesScreen, CategoryManager });
