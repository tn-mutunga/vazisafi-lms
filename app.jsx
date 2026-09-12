// Safi — main app
// Loaded last as <script type="text/babel" src="app.jsx">
const { useState: useAppState, useEffect: useAppEffect } = React;

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

  // Apply direction + density to root
  useAppEffect(() => {
    document.documentElement.dataset.direction = t.direction;
    document.documentElement.dataset.density = t.density;
  }, [t.direction, t.density]);

  function tryEnterOwner() {
    if (!t.ownerPin) { setRole('owner'); setView('dashboard'); return; }
    setPinInput(''); setPinError(''); setPinPrompt(true);
  }
  function submitPin() {
    if (pinInput === String(t.ownerPin)) {
      setPinPrompt(false);
      setRole('owner');
      setView('dashboard');
    } else {
      setPinError('Wrong PIN. Try again.');
      setPinInput('');
    }
  }

  function safeSetRole(r) {
    if (r === 'owner' && role !== 'owner') tryEnterOwner();
    else { setRole(r); setView('dashboard'); }
  }

  const money = (n) => fmtMoney(n, t.currency);
  const lang = t.lang;
  const shop = {
    name: t.shopName, tagline: t.shopTagline,
    address: t.shopAddress, kra: t.shopKRA, web: t.shopWeb,
    mpesaTill: t.shopMpesaTill, bank: t.shopBank, footerMsg: t.shopFooterMsg,
    terms: t.shopTerms,
    ownerPin: t.ownerPin,
  };

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
        case 'packages':     return <PackagesScreen {...props}/>;
        case 'issues':       return <IssuesScreen {...props}/>;
        case 'expenses':     return <ExpensesScreen {...props} role="frontdesk"/>;
        case 'dispatch':     return <DispatchScreen {...props}/>;
        case 'messages':     return <MessagesScreen {...props}/>;
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
        case 'issues':     return <IssuesScreen {...props}/>;
        case 'expenses':   return <ExpensesScreen {...props} role="owner"/>;
        case 'dispatch':   return <DispatchScreen {...props}/>;
        case 'messages':   return <MessagesScreen {...props}/>;
        case 'approvals':  return <ApprovalsScreen {...props}/>;
        case 'settings':   return <SettingsScreen {...props}/>;
        case 'data':       return <DataScreen {...props}/>;
        case 'order-detail': return <OrderDetail {...props} role="owner"/>;
        case 'orders':     return <OrdersQueue {...props} role="owner"/>;
        default:           return <OwnerDashboard {...props}/>;
      }
    }
  })();

  return (
    <div className="safi-app" data-screen-label={`${role}/${view}`}>
      <Sidebar role={role} setRole={safeSetRole} view={view} setView={setView} lang={lang} shop={shop}/>
      <main className="safi-main">{screen}</main>
      <ToastHost/>

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
        <TweakText label="Owner PIN" value={t.ownerPin}
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
