// ─── Price models (owner) ─────────────────────────────────────────────────
const { useState: useStatePM } = React;

function PriceModels({ money }) {
  useStore();
  const P = window.SAFI_PRICING;
  const models = P.models();
  const activeId = P.activeId();
  const [confirm, setConfirm] = useStatePM(null);
  const [edit, setEdit] = useStatePM(null);
  const SAMPLE_KG = [3, 5, 7, 10];

  function saveEdit() {
    const m = edit;
    if (!m.name.trim()) { toast('Name required', 'error'); return; }
    const clean = r => r.kind === 'block'
      ? { base: +r.base || 0, upTo: +r.upTo || 0, extra: +r.extra || 0 }
      : { rate: +r.rate || 0, min: +r.min || 0 };
    const out = { id: m.id, name: m.name.trim(), label: (m.label || '').trim(), desc: m.desc || '', focus: !!m.focus,
      rules: { student: clean(m.rules.student), normal: clean(m.rules.normal) } };
    const list = models.some(x => x.id === out.id) ? models.map(x => x.id === out.id ? out : x) : [...models, out];
    window.SAFI_STORE.savePriceModels(list);
    setEdit(null);
    toast('Price model saved', 'success');
  }
  const toForm = r => r.base != null ? { kind: 'block', ...r } : { kind: 'perkg', ...r };
  function openEdit(m, dup) {
    setEdit({ ...m, id: dup ? 'pm' + Date.now().toString(36) : m.id, name: dup ? m.name + ' copy' : m.name, isNew: dup,
      rules: { student: toForm(m.rules.student), normal: toForm(m.rules.normal) } });
  }
  function remove(m) {
    window.SAFI_STORE.savePriceModels(models.filter(x => x.id !== m.id));
    setEdit(null);
    toast('Price model removed', 'success');
  }
  const setRule = (tier, patch) => setEdit({ ...edit, rules: { ...edit.rules, [tier]: { ...edit.rules[tier], ...patch } } });

  return (
    <>
      <div className="safi-pm__head">
        <div>
          <h3 className="safi-pm__title">Wash & Fold price models</h3>
          <p className="safi-cell-sub">The active model prices Wash & Fold for students and normal clients. Corporate Wash & Fold stays at its contract rate. Orders already taken keep the price they were charged.</p>
        </div>
      </div>
      <div className="safi-pm__grid">
        {(() => {
          const sd = P.studentDay();
          const live = P.studentDayLive();
          return (
            <div className={`safi-pm safi-pm--day ${live ? 'is-active' : ''}`}>
              <div className="safi-pm__top">
                <div><b className="safi-pm__name">Student Thursday</b><div className="safi-pm__label">Automatic every Thursday</div></div>
                <div className="safi-pm__tags">{live ? <span className="safi-tag safi-tag--green">On today</span> : sd.on ? <span className="safi-tag safi-tag--gray">Next Thursday</span> : <span className="safi-tag safi-tag--gray">Off</span>}</div>
              </div>
              <p className="safi-pm__desc">On Thursdays students pay a flat rate per kg for Wash & Fold, with no minimum, and every duvet (any size) costs the Thursday duvet price. Normal clients, and every other day, use the active model.</p>
              <div className="safi-form__row">
                <label>Student rate (KES/kg)<input type="number" className="safi-input safi-mono" defaultValue={sd.rate}
                  onBlur={e => { const v = Number(e.target.value) || 0; if (v !== sd.rate) { window.SAFI_STORE.setSetting('studentDay', { ...sd, rate: v }); window.SAFI_STORE.audit('pricing.studentday', 'rate', `Student Thursday rate → ${v}`); } }}/></label>
                <label>Student duvet, Thursday (KES)<input type="number" className="safi-input safi-mono" defaultValue={P.thursdayDuvet()}
                  onBlur={e => { const v = Number(e.target.value) || 0; if (v !== P.thursdayDuvet()) { window.SAFI_STORE.setSetting('studentDay', { ...P.studentDay(), duvet: v }); window.SAFI_STORE.audit('pricing.studentday', 'duvet', `Student Thursday duvet → ${v}`); } }}/></label>
              </div>
              <table className="safi-pm__table">
                <thead><tr><th></th>{SAMPLE_KG.map(k => <th key={k}>{k} kg</th>)}</tr></thead>
                <tbody><tr><td>Student</td>{SAMPLE_KG.map(k => <td key={k} className="safi-mono">{P.charge({ rate: sd.rate, min: 0 }, k)}</td>)}</tr></tbody>
              </table>
              <label className="safi-toggle safi-toggle--lg">
                <input type="checkbox" checked={sd.on} onChange={e => { window.SAFI_STORE.setSetting('studentDay', { ...sd, on: e.target.checked }); window.SAFI_STORE.audit('pricing.studentday', 'toggle', `Student Thursday ${e.target.checked ? 'on' : 'off'}`); }}/>
                <span/><div><b>{sd.on ? 'On' : 'Off'}</b></div>
              </label>
            </div>
          );
        })()}
        {(() => {
          const b = P.bathDay();
          const live = P.bathDayLive();
          const save = (patch, what) => { window.SAFI_STORE.setSetting('bathDay', { ...P.bathDay(), ...patch }); window.SAFI_STORE.audit('pricing.bathday', 'edit', what); };
          const nd = b.normalDuvet || {};
          return (
            <div className={`safi-pm safi-pm--day ${live ? 'is-active' : ''}`}>
              <div className="safi-pm__top">
                <div><b className="safi-pm__name">Bath & Beddings Tuesday</b><div className="safi-pm__label">Automatic every Tuesday</div></div>
                <div className="safi-pm__tags">{live ? <span className="safi-tag safi-tag--green">On today</span> : b.on ? <span className="safi-tag safi-tag--gray">Next Tuesday</span> : <span className="safi-tag safi-tag--gray">Off</span>}</div>
              </div>
              <p className="safi-pm__desc">Duvet / Bedding items only. Normal duvets step down by size, student duvets drop to one price, and every other bed & bath item added to the order is {b.pct}% off. Corporate is unchanged.</p>
              <table className="safi-pm__table">
                <thead><tr><th>Normal duvet</th><th>Usual</th><th>Tuesday</th></tr></thead>
                <tbody>
                  {Object.keys(nd).sort((x, y) => y - x).map(k => (
                    <tr key={k}><td></td><td className="safi-mono">{k}</td><td><input type="number" className="safi-input safi-mono" style={{ width: 90 }} defaultValue={nd[k]}
                      onBlur={e => { const v = Number(e.target.value) || 0; if (v !== nd[k]) save({ normalDuvet: { ...nd, [k]: v } }, `Tuesday duvet ${k} → ${v}`); }}/></td></tr>
                  ))}
                </tbody>
              </table>
              <div className="safi-form__row">
                <label>Student duvet, Tuesday (KES)<input type="number" className="safi-input safi-mono" defaultValue={b.studentDuvet}
                  onBlur={e => { const v = Number(e.target.value) || 0; if (v !== b.studentDuvet) save({ studentDuvet: v }, `Tuesday student duvet → ${v}`); }}/></label>
                <label>Other bed & bath items (% off)<input type="number" className="safi-input safi-mono" defaultValue={b.pct}
                  onBlur={e => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); if (v !== b.pct) save({ pct: v }, `Tuesday bed & bath → ${v}% off`); }}/></label>
              </div>
              <label>Student duvet, every other day (KES)<input type="number" className="safi-input safi-mono" defaultValue={P.studentDuvet()}
                onBlur={e => { const v = Number(e.target.value) || 0; if (v !== P.studentDuvet()) { window.SAFI_STORE.setSetting('studentDuvetPrice', v); window.SAFI_STORE.audit('pricing.studentduvet', 'edit', `Student duvet → ${v}`); } }}/></label>
              <label className="safi-toggle safi-toggle--lg">
                <input type="checkbox" checked={b.on} onChange={e => save({ on: e.target.checked }, `Bath & Beddings Tuesday ${e.target.checked ? 'on' : 'off'}`)}/>
                <span/><div><b>{b.on ? 'On' : 'Off'}</b></div>
              </label>
            </div>
          );
        })()}
        {models.map(m => {
          const on = m.id === activeId;
          return (
            <div key={m.id} className={`safi-pm ${on ? 'is-active' : ''}`}>
              <div className="safi-pm__top">
                <div><b className="safi-pm__name">{m.name}</b>{m.label && <div className="safi-pm__label">{m.label}</div>}</div>
                <div className="safi-pm__tags">
                  {m.focus && <span className="safi-tag safi-tag--amber">Focus</span>}
                  {on && <span className="safi-tag safi-tag--green">Active</span>}
                </div>
              </div>
              <p className="safi-pm__desc">{m.desc}</p>
              <dl className="safi-pm__rules">
                <div><dt>Students</dt><dd>{P.describe(m.rules.student)}</dd></div>
                <div><dt>Normal</dt><dd>{P.describe(m.rules.normal)}</dd></div>
              </dl>
              <table className="safi-pm__table">
                <thead><tr><th></th>{SAMPLE_KG.map(k => <th key={k}>{k} kg</th>)}</tr></thead>
                <tbody>
                  {['student', 'normal'].map(g => (
                    <tr key={g}><td>{g === 'student' ? 'Student' : 'Normal'}</td>
                      {SAMPLE_KG.map(k => <td key={k} className="safi-mono">{m.rules[g] ? P.charge(m.rules[g], k) : '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="safi-pm__actions">
                {on ? <span className="safi-cell-sub">In use at the till</span>
                  : <Button kind="primary" onClick={() => setConfirm(m)}>Activate</Button>}
                <button className="safi-rowlink" onClick={() => openEdit(m, false)}>Edit</button>
                <button className="safi-rowlink" onClick={() => openEdit(m, true)}>Duplicate</button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Activate ${confirm?.name}?`}
        footer={<>
          <Button kind="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button kind="primary" onClick={() => { window.SAFI_STORE.activatePriceModel(confirm.id); toast(`${confirm.name} is now active`, 'success'); setConfirm(null); }}>Activate</Button>
        </>}>
        {confirm && <p>New orders will be priced with <b>{confirm.name}</b>: students {P.describe(confirm.rules.student)}; normal clients {P.describe(confirm.rules.normal)}. Existing orders are not changed. The switch is recorded in the audit log.</p>}
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.isNew ? 'New price model' : `Edit ${edit?.name || ''}`}
        footer={<>
          {edit && !edit.isNew && edit.id !== activeId && <Button kind="ghost" onClick={() => remove(edit)}>Delete</Button>}
          <Button kind="ghost" onClick={() => setEdit(null)}>Cancel</Button>
          <Button kind="primary" onClick={saveEdit}>Save</Button>
        </>}>
        {edit && (
          <div className="safi-form">
            <label>Name<input className="safi-input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })}/></label>
            <label>Label<input className="safi-input" value={edit.label || ''} onChange={e => setEdit({ ...edit, label: e.target.value })}/></label>
            <label>How it works<input className="safi-input" value={edit.desc} onChange={e => setEdit({ ...edit, desc: e.target.value })}/></label>
            {['student', 'normal'].map(g => {
              const r = edit.rules[g];
              return (
                <div key={g} className="safi-pm__edit">
                  <b>{g === 'student' ? 'Students' : 'Normal clients'}</b>
                  <div className="safi-seg">
                    <button className={`safi-seg__btn ${r.kind === 'perkg' ? 'is-active' : ''}`} onClick={() => setRule(g, { kind: 'perkg' })}>Per kg + minimum</button>
                    <button className={`safi-seg__btn ${r.kind === 'block' ? 'is-active' : ''}`} onClick={() => setRule(g, { kind: 'block' })}>Standing charge</button>
                  </div>
                  {r.kind === 'perkg' ? (
                    <div className="safi-form__row">
                      <label>KES per kg<input type="number" className="safi-input safi-mono" value={r.rate ?? ''} onChange={e => setRule(g, { rate: e.target.value })}/></label>
                      <label>Minimum (0 = none)<input type="number" className="safi-input safi-mono" value={r.min ?? ''} onChange={e => setRule(g, { min: e.target.value })}/></label>
                    </div>
                  ) : (
                    <div className="safi-form__row">
                      <label>Charge (KES)<input type="number" className="safi-input safi-mono" value={r.base ?? ''} onChange={e => setRule(g, { base: e.target.value })}/></label>
                      <label>Up to (kg)<input type="number" className="safi-input safi-mono" value={r.upTo ?? ''} onChange={e => setRule(g, { upTo: e.target.value })}/></label>
                      <label>Extra per kg<input type="number" className="safi-input safi-mono" value={r.extra ?? ''} onChange={e => setRule(g, { extra: e.target.value })}/></label>
                    </div>
                  )}
                </div>
              );
            })}
            <label className="safi-check"><input type="checkbox" checked={!!edit.focus} onChange={e => setEdit({ ...edit, focus: e.target.checked })}/> Mark as a focus model</label>
          </div>
        )}
      </Modal>
    </>
  );
}

Object.assign(window, { PriceModels });
