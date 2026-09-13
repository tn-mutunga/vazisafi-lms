// Vazi Safi — Integrity (Management only)
// Reads SAFI_INTEGRITY.scan() and puts the unexplained things in one place. Nothing here
// is visible to the front desk, and nothing here writes to the books.
const { useState: useStateIn, useMemo: useMemoIn } = React;

const SEV = {
  high: { label: 'Act on this', cls: 'red' },
  med:  { label: 'Worth asking', cls: 'amber' },
  low:  { label: 'For information', cls: 'gray' },
};

function FlagCard({ flag, money }) {
  const [open, setOpen] = useStateIn(flag.sev === 'high');
  const sev = SEV[flag.sev] || SEV.low;
  const keys = flag.rows.length ? Object.keys(flag.rows[0]) : [];
  const head = { order: 'Order', at: 'When', staff: 'Attendant / rider', amount: 'Amount', tag: 'Tag / card no.',
    balance: 'Balance', expected: 'Expected', declared: 'Declared', variance: 'Variance',
    method: 'Method', txn: 'Code', other: 'Also on', detail: 'Change', reason: 'Reason',
    pct: 'Discount', off: 'Value' };
  const moneyKeys = ['amount', 'balance', 'expected', 'declared', 'variance', 'off'];

  return (
    <section className={`safi-flag safi-flag--${sev.cls}`}>
      <button className="safi-flag__hd" onClick={() => setOpen(!open)}>
        <span className={`safi-tag safi-tag--${sev.cls}`}>{sev.label}</span>
        <b>{flag.title}</b>
        <span className="safi-flag__n">{flag.count}</span>
        <Icon name="arrow" size={15} style={{ transform: open ? 'rotate(90deg)' : '', marginLeft: 'auto', opacity: .5 }}/>
      </button>
      {open && (
        <div className="safi-flag__body">
          <p className="safi-cell-sub" style={{ marginTop: 0 }}>{flag.detail}</p>
          {!!flag.rows.length && (
            <Table
              cols={keys.map(k => ({
                label: head[k] || k,
                render: r => moneyKeys.includes(k)
                  ? <span className="safi-mono">{money(r[k])}</span>
                  : <span className={k === 'order' || k === 'tag' || k === 'txn' ? 'safi-mono' : ''}>{String(r[k] ?? '—')}</span>
              }))}
              rows={flag.rows.slice(0, 40)}
              empty="—"
            />
          )}
          {flag.rows.length > 40 && <p className="safi-hint">Showing the first 40 of {flag.rows.length}.</p>}
        </div>
      )}
    </section>
  );
}

function IntegrityScreen({ money }) {
  const D = useStore();
  const [days, setDays] = useStateIn(30);
  const [tab, setTab] = useStateIn('flags');
  const res = useMemoIn(() => window.SAFI_INTEGRITY.scan({ days }), [D, days]);

  const staffName = (id) => (D.staff || []).find(s => s.id === id)?.name || '—';
  const clean = res.flags.length === 0;

  return (
    <>
      <Topbar
        title="Integrity"
        subtitle="Everything the books cannot explain on their own. Management only — the front desk never sees this screen."
        right={
          <div className="safi-seg">
            {[7, 30, 90].map(d => (
              <button key={d} className={days === d ? 'is-on' : ''} onClick={() => setDays(d)}>{d}d</button>
            ))}
          </div>
        }
      />

      <div className="safi-stat-row">
        <StatCard label="Orders in period" value={res.totals.orders} icon="box"/>
        <StatCard label="Customer SMS coverage"
          value={res.totals.smsCoverage === null ? '—' : res.totals.smsCoverage + '%'} icon="sms"/>
        <StatCard label="Orders with a tag"
          value={res.totals.tagged === null ? '—' : res.totals.tagged + '%'} icon="tag"/>
        <StatCard label="Needs acting on" value={res.totals.high} icon="alert"/>
      </div>

      <div className="safi-tabs">
        {[['flags', `Findings (${res.flags.length})`], ['staff', 'By attendant'], ['shifts', 'Shift cash'], ['trail', 'Audit trail']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'flags' && (res.totals.orders === 0 && res.flags.length === 0 ? (
        <Card title="No activity in this period">
          <p className="safi-cell-sub" style={{ margin: 0 }}>
            No orders were taken in the last {days} days, so there is nothing to check. Findings
            appear here as orders come in — widen the period above if you are looking further back.
          </p>
        </Card>
      ) : clean ? (
        <Card title="Nothing unexplained">
          <p className="safi-cell-sub" style={{ margin: 0 }}>
            Every order in the last {days} days has a customer SMS, a tag number, and a payment that
            reconciles. Keep the checks in place — a clean read is only meaningful while they run.
          </p>
        </Card>
      ) : (
        <div className="safi-flags">
          {res.totals.orders === 0 && (
            <p className="safi-hint" style={{ margin: 0 }}>
              No orders fell in the last {days} days, but these findings are dated independently.
            </p>
          )}
          {res.flags.map((f, i) => <FlagCard key={i} flag={f} money={money}/>)}
        </div>
      ))}

      {tab === 'staff' && (
        <Card title="By attendant" pad={false}>
          <Table
            cols={[
              { label: 'Attendant', render: r => <b>{r.name}</b> },
              { label: 'Orders', render: r => r.orders },
              { label: 'Revenue', render: r => <span className="safi-mono">{money(r.revenue)}</span> },
              { label: 'SMS sent', render: r => r.smsRate === null ? '—' :
                <span className={r.smsRate < 95 ? 'safi-neg' : ''}>{r.smsRate}%</span> },
              { label: 'No M-Pesa code', render: r => r.noCode || '—' },
              { label: 'Deleted orders', render: r => r.deletes || '—' },
              { label: 'Cash variance', render: r => r.shifts
                ? <span className={r.varianceTotal < 0 ? 'safi-neg' : ''}>{money(r.varianceTotal)}</span> : '—' },
              { label: 'Risk', render: r => (
                <div className="safi-risk">
                  <div className="safi-risk__bar"><span style={{ width: Math.max(3, r.risk) + '%' }}/></div>
                  <b>{r.risk}</b>
                </div>
              )},
            ]}
            rows={res.staff}
            empty="No attendant activity in this period."
          />
        </Card>
      )}

      {tab === 'shifts' && (
        <Card title="Shift cash counts" pad={false}>
          <Table
            cols={[
              { label: 'Attendant', render: r => staffName(r.staff) },
              { label: 'Opened', render: r => r.openedAtLabel || String(r.openedAt).slice(0, 16).replace('T', ' ') },
              { label: 'Closed', render: r => r.closedAtLabel || (r.closedAt ? String(r.closedAt).slice(0, 16).replace('T', ' ') : <span className="safi-tag safi-tag--amber">Still open</span>) },
              { label: 'Float', render: r => <span className="safi-mono">{money(r.openingFloat)}</span> },
              { label: 'Expected', render: r => <span className="safi-mono">{r.closedAt ? money(r.expectedCash) : '—'}</span> },
              { label: 'Counted', render: r => <span className="safi-mono">{r.closedAt ? money(r.declaredCash) : '—'}</span> },
              { label: 'Difference', render: r => !r.closedAt ? '—' :
                <span className={`safi-mono ${r.variance < 0 ? 'safi-neg' : r.variance > 0 ? 'safi-pos' : ''}`}>
                  {r.variance > 0 ? '+' : ''}{money(r.variance)}
                </span> },
              { label: 'Note', render: r => r.note || '' },
            ]}
            rows={D.shifts || []}
            empty="No shifts recorded yet. Ask the counter to open a shift at the start of each day."
          />
        </Card>
      )}

      {tab === 'trail' && (
        <Card title="Audit trail" pad={false}
          action={<span className="safi-hint">Append-only. Nothing here can be edited or removed from inside the app.</span>}>
          <Table
            cols={[
              { label: 'When', render: r => String(r.at).slice(0, 16).replace('T', ' ') },
              { label: 'Who', render: r => staffName(r.staff) },
              { label: 'Action', render: r => <span className="safi-mono">{r.action}</span> },
              { label: 'Order', render: r => <span className="safi-mono">{r.target || '—'}</span> },
              { label: 'Detail', render: r => r.detail || '' },
            ]}
            rows={(D.auditLog || []).slice(0, 300)}
            empty="Nothing logged yet."
          />
        </Card>
      )}
    </>
  );
}

Object.assign(window, { IntegrityScreen });
