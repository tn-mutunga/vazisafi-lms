// Safi — main app
// Loaded last as <script type="text/babel" src="app.jsx">
const { useState: useAppState, useEffect: useAppEffect } = React;


// Roll printing: make each printed page exactly as long as its content (no blank paper).
// Measures the receipt / job card / delivery note at the 76mm print width just before
// printing and sets the page length to fit, plus a small tear-off margin.
(function () {
  if (window.__safiRollFit) return; window.__safiRollFit = true;
  const MM = 25.4 / 96;
  // Measure with the same box the print CSS uses (76mm wide, print padding),
  // otherwise the screen padding wraps more lines and overstates the height.
  function measure(el, pad, width = '76mm') {
    // Measure a copy in an empty off-screen box 76mm wide, so the screen layout
    // (flex rows, tall neighbours, the preview frame) can't stretch the result.
    try {
      const box = document.createElement('div');
      box.className = (el.parentElement && el.parentElement.className) || '';
      box.style.cssText = 'position:absolute;left:-30000px;top:0;display:block;width:76mm;height:auto;min-height:0;padding:0;margin:0;visibility:hidden;overflow:visible';
      const c = el.cloneNode(true);
      const cs = c.style;
      cs.width = '76mm'; cs.maxWidth = '76mm'; cs.boxSizing = 'border-box'; cs.height = 'auto'; cs.minHeight = '0';
      cs.margin = '0'; cs.position = 'static'; cs.flex = 'none'; cs.alignSelf = 'auto'; cs.transform = 'none';
      if (pad) cs.padding = pad;
      box.appendChild(c); document.body.appendChild(box);
      const h = c.getBoundingClientRect().height;
      box.remove();
      if (h > 40) { const hp = el.getBoundingClientRect().height; return Math.ceil(Math.max(h, hp) * MM) + 8; }
    } catch (e) {}
    // Fallback: measure in place.
    // On screen the receipt sits in a flex row and is stretched to the row's height,
    // so measure it un-stretched (auto height, top-aligned) and read its real content height.
    const s = el.style, keep = [s.width, s.maxWidth, s.padding, s.boxSizing, s.height, s.minHeight, s.alignSelf];
    if (width) { s.width = width; s.maxWidth = width; s.boxSizing = 'border-box'; }
    if (pad) s.padding = pad;
    s.height = 'auto'; s.minHeight = '0'; s.alignSelf = 'flex-start';
    const h = el.getBoundingClientRect().height;
    [s.width, s.maxWidth, s.padding, s.boxSizing, s.height, s.minHeight, s.alignSelf] = keep;
    return Math.ceil(h * MM) + 6;
  }
  // Copy every @media print rule into a temporary stylesheet so the receipt is measured
  // with its PRINT sizes (fonts, padding, widths), not its screen sizes.
  function printRulesText() {
    let out = '';
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules || []) {
        if (r.type === 4 && /print/.test(r.media.mediaText)) {
          for (const c of r.cssRules) if (c.type !== 6 && !/^@page/.test(c.cssText)) out += c.cssText + '\n';
        }
      }
    }
    return out;
  }
  // Returns the roll length in mm (0 = not a roll print) and applies the matching @page.
  function fit() {
    const tmp = document.createElement('style'); tmp.id = 'safi-roll-measure'; tmp.textContent = printRulesText();
    document.head.appendChild(tmp);
    let h = 0;
    const sheet = document.querySelector('.safi-jcsheet--roll');
    const rec = document.querySelector('.safi-receipt-wrap #safi-print-area, #safi-print-area.safi-receipt');
    if (sheet) {
      // Job card + delivery note print as ONE strip, one after the other, no gap between them.
      const parts = [...sheet.querySelectorAll('.safi-jc, .safi-dn')];
      h = parts.reduce((s, el) => s + measure(el, '', ''), 0) - Math.max(0, parts.length - 1) * 6;
    } else if (rec && !document.querySelector('.safi-jcsheet:not(.safi-jcsheet--roll)')) {
      h = measure(rec, '', '');
    }
    let st = document.getElementById('safi-roll-fit');
    if (!st) { st = document.createElement('style'); st.id = 'safi-roll-fit'; document.head.appendChild(st); }
    st.textContent = h ? `@page{size:80mm ${h}mm;margin:0}.safi-jcsheet--roll .safi-jc,.safi-jcsheet--roll .safi-dn{break-before:auto!important;break-after:auto!important;page-break-before:auto!important;page-break-after:auto!important;page:auto!important}` : '';
    tmp.remove();
    return h;
  }
  window.__safiRollFit = fit;
  window.addEventListener('beforeprint', fit);
  // Desktop app: printer drivers ignore the page length set in CSS and feed a full page,
  // leaving metres of blank paper. Send the exact length to the printer instead.
  if (window.lms && window.lms.printPage && !window.__safiPrintPatched) {
    window.__safiPrintPatched = true;
    const nativePrint = window.print.bind(window);
    window.print = () => {
      const h = fit();
      if (!h) return nativePrint();
      window.lms.printPage({ heightMm: h }).then(r => { if (!r || !r.ok) { if (r && r.reason && !/cancel/i.test(r.reason)) nativePrint(); } }).catch(() => nativePrint());
    };
  }
  window.addEventListener('afterprint', () => { const st = document.getElementById('safi-roll-fit'); if (st) st.textContent = ''; });
})();

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "navy",
  "density": "regular",
  "lang": "en",
  "currency": "KES 1,500",
  "shopName": "Vazi Safi Laundry",
  "shopTagline": "We do laundry. You do life.",
  "shopAddress": "Nairobi, Kenya · +254 700 000 000",
  "shopKRA": "P.O. Box 0000-00100 · KRA PIN P000000000A",
  "shopWeb": "vazisafi.co.ke",
  "shopMpesaTill": "Lipa na M-Pesa Till: 000000",
  "shopBank": "Bank: Equity 0000-0000-0000 · Vazi Safi Ltd",
  "shopFooterMsg": "ASANTE — KARIBU TENA",
  "shopTerms": "Items uncollected after 30 days are donated. Claims must be made within 24 hrs of collection. Keep this receipt — required for pickup. Asante sana!",
  "ownerPin": "123456"
}/*EDITMODE-END*/;

// Chimes (offline, generated). Volume 0–100 from Settings → Sounds.
function safiSound(kind) {
  try {
    const st = window.SAFI_STORE.get().settings || {};
    const vol = Math.max(0, Math.min(100, st.chimeVolume == null ? 70 : Number(st.chimeVolume))) / 100;
    if (!vol) return;
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    const ctx = safiSound.ctx = safiSound.ctx || new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    const notes = kind === 'request' ? [784, 988, 1175, 988, 1175] : [988, 784, 1175];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.2;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45 * vol + 0.0001, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.2);
    });
  } catch (e) {}
}
window.safiSound = safiSound;

// Management: chime when a new request for approval arrives (and every 2 minutes while any is waiting).
function ApprovalChime({ role }) {
  const D = useStore();
  const st = D.settings || {};
  const pending = (D.approvals || []).filter(a => a.status === 'pending').map(a => a.id);
  const key = pending.join(',');
  const prev = React.useRef(null);
  // Plays in Management, and on any laptop where "this laptop" was ticked in Settings → Sounds.
  const here = role === 'owner' || localStorage.getItem('safi_request_chime_here') === '1';
  useAppEffect(() => {
    if (prev.current === null) { prev.current = pending; return; }
    const isNew = pending.some(id => !prev.current.includes(id));
    prev.current = pending;
    if (isNew && st.approvalChime !== false && here) safiSound('request');
  }, [key]);
  useAppEffect(() => {
    if (!pending.length || st.approvalChime === false || !here) return;
    const t = setInterval(() => safiSound('request'), 120000);
    return () => clearInterval(t);
  }, [key, here, st.approvalChime]);
  return null;
}

// Front Desk: shows Management's decisions on requests this laptop hasn't seen yet.
function DecisionNotice() {
  const D = useStore();
  const KEY = 'safi_seen_decisions_v1';
  const [seen, setSeen] = useAppState(() => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } });
  // First run: treat everything already decided as seen, so old decisions don't pop up.
  useAppEffect(() => { if (seen === null) { const ids = (D.approvals || []).filter(a => a.status !== 'pending').map(a => a.id); localStorage.setItem(KEY, JSON.stringify(ids)); setSeen(ids); } }, [seen]);
  const acks = ((D.settings || {}).approvalAcks) || {};
  // Front desk chime when Management replies.
  const freshIds = (D.approvals || []).filter(a => a.status !== 'pending' && seen && !seen.includes(a.id) && !acks[a.id] && !(a.payload && a.payload.ackAt)).map(a => a.id).join(',');
  useAppEffect(() => { if (freshIds && (D.settings || {}).replyChime !== false) safiSound('reply'); }, [freshIds]);
  if (seen === null) return null;
  // Hidden once any laptop pressed OK (acknowledgement is synced).
  const fresh = (D.approvals || []).filter(a => a.status !== 'pending' && !seen.includes(a.id) && !acks[a.id] && !(a.payload && a.payload.ackAt));
  if (!fresh.length) return null;
  const label = { delete_order: 'Delete order', rewash_order: 'Rewash', edit_order: 'Edit order', refund_order: 'Refund', reprint_receipt: 'Receipt reprint' };
  const dismiss = () => {
    const ids = [...seen, ...fresh.map(a => a.id)]; localStorage.setItem(KEY, JSON.stringify(ids)); setSeen(ids);
    window.SAFI_STORE.ackApprovals(fresh.map(x => x.id));
    setTimeout(() => { try { window.SAFI_CLOUD && window.SAFI_CLOUD.syncNow && window.SAFI_CLOUD.syncNow().catch(() => {}); } catch (e) {} }, 300);
  };
  return (
    <div className="safi-decision">
      <div className="safi-decision__hd"><Icon name="bell" size={16}/><b>Management replied to {fresh.length} request{fresh.length > 1 ? 's' : ''}</b></div>
      <ul>
        {fresh.slice(0, 5).map(a => (
          <li key={a.id}>
            <span className={`safi-pill safi-pill--${a.status === 'approved' ? 'green' : 'red'}`}>{a.status === 'approved' ? 'Approved' : 'Rejected'}</span>
            <span>{label[a.action] || a.action} · <b className="safi-mono">{orderNo(a.target)}</b>{a.decisionNote ? <span className="safi-cell-sub"> — {a.decisionNote}</span> : null}</span>
          </li>
        ))}
      </ul>
      <Button kind="primary" size="sm" icon="check" onClick={dismiss}>OK, got it</Button>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role, setRole] = useAppState('frontdesk');
  const [view, setView] = useAppState('dashboard');
  const [activeOrderId, setActiveOrderId] = useAppState('SF-2418');
  const [pinPrompt, setPinPrompt] = useAppState(false);
  const [pinInput, setPinInput] = useAppState('');
  const [pinError, setPinError] = useAppState('');

  // expose setTweak globally so Management Settings screen can call it
  useAppEffect(() => { window.__safiSetTweak = setTweak; }, [setTweak]);
  useAppEffect(() => { window.__safiSetView = setView; }, []);
  useAppEffect(() => { window.__safiGoFrontDesk = () => { setRole('frontdesk'); setView('dashboard'); }; }, []);
  useAppEffect(() => { const f = () => { setRole('frontdesk'); setView('dashboard'); }; window.addEventListener('safi-signout', f); return () => window.removeEventListener('safi-signout', f); }, []);
  // Test hook: open an order's receipt (used for print-length checks).
  useAppEffect(() => { window.__safiOpenReceipt = (id) => { setActiveOrderId(id); setView('receipt'); }; }, []);

  // Apply direction + density to root
  useAppEffect(() => {
    document.documentElement.dataset.direction = t.direction;
    document.documentElement.dataset.density = t.density;
  }, [t.direction, t.density]);

  function tryEnterOwner() {
    if (!shop.ownerPin) { setRole('owner'); setView('dashboard'); return; }
    setPinInput(''); setPinError(''); setPinPrompt(true);
  }
  function submitPin() {
    if (pinInput === String(shop.ownerPin)) {
      setPinPrompt(false);
      setRole('owner');
      setView('dashboard');
    } else {
      setPinError('Wrong PIN. Try again.');
      setPinInput('');
    }
  }

  function safeSetRole(r) {
    const ses = window.safiSession && window.safiSession();
    if (r === 'owner' && role !== 'owner' && (window.SAFI_STORE.get().settings || {}).lockEnabled && ses && ses.kind === 'management') { setRole('owner'); setView('dashboard'); return; }
    if (r === 'owner' && role !== 'owner') tryEnterOwner();
    else { setRole(r); setView('dashboard'); }
  }

  const money = (n) => fmtMoney(n, t.currency);
  const lang = t.lang;
  // Shop details live in the synced settings, so a change on one laptop shows on all.
  // Tweak values are only the fallback until the first save.
  const SS = (useStore().settings) || {};
  const pick = (k) => (SS[k] != null && SS[k] !== '' ? SS[k] : t[k]);
  const shop = {
    name: pick('shopName'), tagline: pick('shopTagline'),
    address: pick('shopAddress'), kra: pick('shopKRA'), web: pick('shopWeb'),
    mpesaTill: pick('shopMpesaTill'), bank: pick('shopBank'), footerMsg: pick('shopFooterMsg'),
    terms: pick('shopTerms'),
    ownerPin: pick('ownerPin'),
  };
  window.SAFI_OWNER_PIN = shop.ownerPin;
  window.__safiOwnerPin = String(shop.ownerPin || '');

  const screen = (() => {
    const props = { setView, setActiveOrderId, lang, money, density: t.density, orderId: activeOrderId, shop, setShop: setTweak };
    if (role === 'frontdesk') {
      switch (view) {
        case 'dashboard':    return <FrontDeskDashboard {...props}/>;
        case 'new-order':    return <NewOrder {...props}/>;
        case 'orders':       return <OrdersQueue {...props} role="frontdesk"/>;
        case 'order-detail': return <OrderDetail {...props} role="frontdesk"/>;
        case 'receipt':      return <Receipt {...props}/>;
        case 'customers':    return <CustomersScreen {...props} role="frontdesk"/>;
        case 'payments':     return <PaymentsScreen {...props} role="frontdesk"/>;
        case 'packages':     return <PackagesScreen {...props} role="frontdesk"/>;
        case 'issues':       return <IssuesScreen {...props}/>;
        case 'expenses':     return <ExpensesScreen {...props} role="frontdesk"/>;
        case 'dispatch':     return <DispatchScreen {...props}/>;
        case 'rider-cards':        return <RiderCardsScreen {...props}/>;
        case 'job-card':           return <JobCardSheet {...props}/>;
        case 'messages':     return <MessagesScreen {...props} role="frontdesk"/>;
        case 'machines':     return <MachinesScreen {...props}/>;
        default:             return <FrontDeskDashboard {...props}/>;
      }
    } else {
      switch (view) {
        case 'dashboard':  return <OwnerDashboard {...props}/>;
        case 'reports':    return <ReportsScreen {...props}/>;
        case 'payments':   return <PaymentsScreen {...props} role="owner"/>;
        case 'customers':  return <CustomersScreen {...props} role="owner"/>;
        case 'pricing':    return <PricingScreen {...props}/>;
        case 'packages':   return <PackagesScreen {...props}/>;
        case 'inventory':  return <InventoryScreen {...props}/>;
        case 'staff':      return <StaffScreen {...props}/>;
        case 'payroll':    return <PayrollScreen {...props}/>;
        case 'issues':     return <IssuesScreen {...props}/>;
        case 'expenses':   return <ExpensesScreen {...props} role="owner"/>;
        case 'dispatch':   return <DispatchScreen {...props}/>;
        case 'messages':   return <MessagesScreen {...props} role="owner"/>;
        case 'machines':   return <MachinesScreen {...props}/>;
        case 'approvals':  return <ApprovalsScreen {...props}/>;
        case 'settings':   return <SettingsScreen {...props}/>;
        case 'data':       return <DataScreen {...props}/>;
        case 'cloud':      return <CloudScreen {...props}/>;
        case 'integrity':  return <IntegrityScreen {...props}/>;
        case 'rider-cards':        return <RiderCardsScreen {...props}/>;
        case 'job-card':           return <JobCardSheet {...props}/>;
        case 'order-detail': return <OrderDetail {...props} role="owner"/>;
        case 'orders':     return <OrdersQueue {...props} role="owner"/>;
        default:           return <OwnerDashboard {...props}/>;
      }
    }
  })();

  return (
    <div className="safi-app" data-screen-label={`${role}/${view}`}>
      <Sidebar role={role} setRole={safeSetRole} view={view} setView={(v) => { window.__safiFromDeck = false; setView(v); }} lang={lang} shop={shop}/>
      <LockScreen onUnlock={(acc) => { if (acc.kind === 'management') { setRole('owner'); setView('dashboard'); } else { if (acc.staffId) window.SAFI_STORE.setCurrentStaff(acc.staffId); setRole('frontdesk'); setView('dashboard'); } }}/>
      <main className="safi-main"><UpdateBar/>{window.DispatchReminders && <window.DispatchReminders setView={setView}/>}{view !== 'dashboard' && !['order-detail', 'receipt', 'jobcard'].includes(view) && (
        <button className="safi-backbar" onClick={() => { if (window.__safiFromDeck) window.__safiScrollTo = 'reminders'; window.__safiFromDeck = false; window.__safiPreset = null; setView('dashboard'); try { const m = document.querySelector('.safi-main'); if (m && !window.__safiScrollTo) m.scrollTop = 0; } catch (e) {} }}><Icon name="arrow-l" size={16}/> Back</button>
      )}{screen}</main>
      <ToastHost/>
      <PinConfirmHost/>
      {role === 'frontdesk' && <DecisionNotice/>}
      <ApprovalChime role={role}/>

      <Modal open={pinPrompt} onClose={() => setPinPrompt(false)} title="Enter Owner PIN" width={360}
        footer={<>
          <Button kind="ghost" onClick={() => setPinPrompt(false)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={submitPin}>Unlock Owner</Button>
        </>}>
        <div className="safi-pin">
          <p className="safi-cell-sub">Owner area is locked. Enter the 6-digit PIN to access reports, pricing, data backup, and other owner controls.</p>
          <input className="safi-input safi-mono safi-pin__input" type="password" inputMode="numeric" maxLength={6} pattern="[0-9]*"
            value={pinInput} onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0,6)); setPinError(''); }}
            onKeyDown={e => e.key === 'Enter' && submitPin()}
            placeholder="••••••" autoFocus/>
          {pinError && <p className="safi-pin__err">{pinError}</p>}
          <p className="safi-cell-sub" style={{ fontSize: 11 }}>You can change this PIN in <b>Tweaks → Security</b>.</p>
        </div>
      </Modal>

      <TweaksPanel>
        <TweakSection label="Your shop"/>
        <TweakText label="Shop name" value={t.shopName}
          onChange={(v) => setTweak('shopName', v)}/>
        <TweakText label="Tagline" value={t.shopTagline}
          onChange={(v) => setTweak('shopTagline', v)}/>
        <TweakText label="Address line" value={t.shopAddress}
          onChange={(v) => setTweak('shopAddress', v)}/>
        <TweakText label="KRA / P.O. Box" value={t.shopKRA}
          onChange={(v) => setTweak('shopKRA', v)}/>
        <TweakText label="Website" value={t.shopWeb}
          onChange={(v) => setTweak('shopWeb', v)}/>

        <TweakSection label="Security"/>
        <TweakText label="Owner PIN" value={shop.ownerPin}
          onChange={(v) => setTweak('ownerPin', v)}/>

        <TweakSection label="Direction"/>
        <TweakRadio label="Visual" value={t.direction} options={['navy', 'sky']}
          onChange={(v) => setTweak('direction', v)}/>
        <TweakSection label="Layout"/>
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']}
          onChange={(v) => setTweak('density', v)}/>
        <TweakSection label="Locale"/>
        <TweakRadio label="Language" value={t.lang} options={['en', 'sw']}
          onChange={(v) => setTweak('lang', v)}/>
        <TweakSelect label="Currency" value={t.currency}
          options={['KES 1,500', 'KSh 1,500', 'Ksh. 1,500/=']}
          onChange={(v) => setTweak('currency', v)}/>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
