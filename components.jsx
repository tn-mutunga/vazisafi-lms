// Safi — shared UI primitives
// Loaded as <script type="text/babel" src="components.jsx">
// Exports components onto window so other Babel scripts can use them.
const { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } = React;

// ─── Theme + i18n contexts ────────────────────────────────────────────────
const ThemeCtx = createContext({});
const useTheme = () => useContext(ThemeCtx);

// ─── Store hook ───────────────────────────────────────────────────────────
function useStore() {
  const [, force] = useState(0);
  useEffect(() => window.SAFI_STORE.subscribe(() => force(n => n + 1)), []);
  return window.SAFI_STORE.get();
}

// ─── Modal ────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, footer, width = 480 }) => {
  if (!open) return null;
  return (
    <div className="safi-modal" onClick={onClose}>
      <div className="safi-modal__sheet" style={{ width }} onClick={e => e.stopPropagation()}>
        <header className="safi-modal__hd">
          <h3>{title}</h3>
          <button className="safi-modal__x" onClick={onClose}>×</button>
        </header>
        <div className="safi-modal__body">{children}</div>
        {footer && <footer className="safi-modal__ft">{footer}</footer>}
      </div>
    </div>
  );
};

// ─── Phone input with country prefix ──────────────────────────────────────
const PHONE_PREFIXES = [
  { code: '+254', country: 'KE', label: 'Kenya' },
  { code: '+255', country: 'TZ', label: 'Tanzania' },
  { code: '+256', country: 'UG', label: 'Uganda' },
  { code: '+250', country: 'RW', label: 'Rwanda' },
  { code: '+251', country: 'ET', label: 'Ethiopia' },
  { code: '+27',  country: 'ZA', label: 'South Africa' },
  { code: '+44',  country: 'GB', label: 'UK' },
  { code: '+1',   country: 'US', label: 'US / Canada' },
  { code: '+971', country: 'AE', label: 'UAE' },
  { code: 'other', country: '🌐', label: 'Other' },
];

// Auto-format a phone number string into groups: "0712345678" → "0712 345 678"
// or "712345678" → "712 345 678"
function formatPhone(raw, prefix = '+254') {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (prefix === '+254') {
    // Kenya: 7XX XXX XXX or 1XX XXX XXX (9 digits), or 0712 345 678 (10)
    if (digits.length <= 3)  return digits;
    if (digits.length <= 6)  return digits.slice(0, 3) + ' ' + digits.slice(3);
    if (digits.length <= 9)  return digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
    return digits.slice(0, 4) + ' ' + digits.slice(4, 7) + ' ' + digits.slice(7, 11);
  }
  // Generic: group by 3
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

const PhoneInput = ({ prefix = '+254', phone = '', onChange }) => {
  const [otherPrefix, setOtherPrefix] = React.useState(prefix && !PHONE_PREFIXES.find(p => p.code === prefix && p.code !== 'other') ? prefix : '');
  const isOther = prefix === 'other' || (!PHONE_PREFIXES.find(p => p.code === prefix));

  function selectPrefix(v) {
    if (v === 'other') {
      onChange?.({ prefix: 'other', phone });
    } else {
      onChange?.({ prefix: v, phone: formatPhone(phone, v) });
    }
  }
  function updatePhone(v) {
    const effective = isOther ? '' : prefix;
    onChange?.({ prefix, phone: formatPhone(v, effective) });
  }
  function updateOtherPrefix(v) {
    let p = v.trim();
    if (p && !p.startsWith('+')) p = '+' + p.replace(/\D/g, '');
    setOtherPrefix(p);
    onChange?.({ prefix: p || 'other', phone });
  }

  return (
    <div className="safi-phone-input-wrap">
      <div className="safi-phone-input">
        <select className="safi-phone-input__prefix" value={isOther ? 'other' : prefix} onChange={e => selectPrefix(e.target.value)}>
          {PHONE_PREFIXES.map(p => <option key={p.code} value={p.code}>{p.code === 'other' ? '🌐 Other' : `${p.code} ${p.country}`}</option>)}
        </select>
        <input className="safi-phone-input__num safi-mono" type="tel" placeholder="712 345 678"
          value={phone}
          onChange={e => updatePhone(e.target.value)}/>
      </div>
      {isOther && (
        <input className="safi-input safi-mono safi-phone-input__other" placeholder="Country code, e.g. +33, +91"
          value={otherPrefix} onChange={e => updateOtherPrefix(e.target.value)}/>
      )}
    </div>
  );
};

// ─── Icon picker with search + library links ──────────────────────────────
const ICON_LIBRARY = [
  'shirt', 'iron', 'wash', 'shoe', 'duvet', 'curtain', 'hanger', 'sock', 'suit', 'dress',
  'jacket', 'towel', 'blanket', 'bag', 'water', 'electric', 'fuel', 'wrench', 'truck',
  'pickup', 'home', 'sms', 'settings', 'map', 'rider', 'dry', 'mpesa', 'wallet', 'tag',
  'package', 'box', 'staff', 'users', 'check', 'plus', 'alert', 'clock', 'chart', 'phone',
  'bell', 'print', 'search', 'list', 'dashboard', 'lock', 'arrow',
];
const IconPicker = ({ value, onChange }) => {
  const [q, setQ] = React.useState('');
  const filtered = ICON_LIBRARY.filter(i => i.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="safi-icon-search">
      <div className="safi-cust-pick__search">
        <Icon name="search" size={14}/>
        <input placeholder="Search icons by name…" value={q} onChange={e => setQ(e.target.value)}/>
      </div>
      <div className="safi-icon-pick safi-icon-pick--scroll">
        {filtered.map(i => (
          <button key={i} className={`safi-icon-pick__btn ${value === i ? 'is-active' : ''}`} onClick={() => onChange(i)} title={i}>
            <Icon name={i} size={20}/>
          </button>
        ))}
        {filtered.length === 0 && <span className="safi-cell-sub" style={{ padding: 10 }}>No matches. Try a broader term, or use a library below.</span>}
      </div>
      <div className="safi-icon-libs">
        <span className="safi-cell-sub">Need more? Free icon libraries (same hand-drawn style):</span>
        <a href="https://feathericons.com" target="_blank" rel="noopener">feathericons.com</a>
        <a href="https://lucide.dev" target="_blank" rel="noopener">lucide.dev</a>
        <a href="https://tabler-icons.io" target="_blank" rel="noopener">tabler-icons.io</a>
        <span className="safi-cell-sub safi-hint" style={{ marginTop: 6 }}>The 47 icons here come from Feather Icons (MIT licensed). Send the name of an icon you'd like added and we'll bake it in.</span>
      </div>
    </div>
  );
};

// ─── Toast (non-blocking confirmation) ────────────────────────────────────
const toastListeners = new Set();
function toast(msg, kind = 'success') {
  toastListeners.forEach(fn => fn({ msg, kind, id: Date.now() }));
}
function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (t) => {
      setItems(prev => [...prev, t]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), 3000);
    };
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
  }, []);
  return (
    <div className="safi-toasts">
      {items.map(t => <div key={t.id} className={`safi-toast safi-toast--${t.kind}`}>{t.msg}</div>)}
    </div>
  );
}

const fmtMoney = (n, fmt = 'KES 1,500') => {
  const num = Math.round(n).toLocaleString('en-KE');
  if (fmt === 'KSh 1,500')   return `KSh ${num}`;
  if (fmt === 'Ksh. 1,500/=') return `Ksh. ${num}/=`;
  return `KES ${num}`;
};

const t = (key, lang) => {
  const s = window.SAFI_I18N[lang] || window.SAFI_I18N.en;
  return s[key] || window.SAFI_I18N.en[key] || key;
};

// ─── Iconography ──────────────────────────────────────────────────────────
// Geometric line icons drawn with SVG. Single stroke, consistent weight.
const Icon = ({ name, size = 18, stroke = 'currentColor' }) => {
  const sw = 1.7;
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'dashboard':  return (<svg {...props}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>);
    case 'plus':       return (<svg {...props}><path d="M12 5v14M5 12h14"/></svg>);
    case 'list':       return (<svg {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>);
    case 'users':      return (<svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
    case 'wallet':     return (<svg {...props}><path d="M19 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h14"/><circle cx="17" cy="13" r="1.2" fill={stroke}/></svg>);
    case 'box':        return (<svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></svg>);
    case 'alert':      return (<svg {...props}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
    case 'chart':      return (<svg {...props}><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>);
    case 'tag':        return (<svg {...props}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>);
    case 'package':    return (<svg {...props}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/></svg>);
    case 'staff':      return (<svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>);
    case 'search':     return (<svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>);
    case 'bell':       return (<svg {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>);
    case 'print':      return (<svg {...props}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>);
    case 'check':      return (<svg {...props}><polyline points="20 6 9 17 4 12"/></svg>);
    case 'phone':      return (<svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>);
    case 'clock':      return (<svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
    case 'arrow':      return (<svg {...props}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>);
    case 'arrow-l':    return (<svg {...props}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>);
    case 'chevron-down': return (<svg {...props}><polyline points="6 9 12 15 18 9"/></svg>);
    case 'shirt':      return (<svg {...props}><path d="M20 4h-4l-2 2-2 2-2-2-2-2H4L2 8l3 3v10h14V11l3-3z"/></svg>);
    case 'iron':       return (<svg {...props}><path d="M3 17h18l-2-7a4 4 0 0 0-4-3H9.5L7 9v3"/><path d="M3 17v2h18v-2"/></svg>);
    case 'wash':       return (<svg {...props}><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="14" r="4"/><circle cx="8" cy="7" r="0.5" fill={stroke}/></svg>);
    case 'shoe':       return (<svg {...props}><path d="M2 17h20l-3-4-3-1-2-3-3 1-5 2-4 1z"/></svg>);
    case 'duvet':      return (<svg {...props}><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3 10h18M9 6v12M15 6v12"/></svg>);
    case 'curtain':    return (<svg {...props}><path d="M3 3h18M5 3v18s2-2 4-2 4 2 4 2V3M14 3v18s2-2 4-2 1 2 1 2V3"/></svg>);
    case 'hanger':     return (<svg {...props}><path d="M12 2v3M12 5a3 3 0 1 0 3 3M3 20l9-7 9 7H3z"/></svg>);
    case 'sock':       return (<svg {...props}><path d="M9 3h6v8l-4 4-3 3a3 3 0 0 0 0 4 3 3 0 0 0 4 0l8-8V3"/></svg>);
    case 'suit':       return (<svg {...props}><path d="M8 4h8l4 4-4 14h-8L4 8z"/><path d="M12 4l-2 4 2 14 2-14-2-4z"/></svg>);
    case 'dress':      return (<svg {...props}><path d="M8 3h8v3l3 5-2 13H7L5 11l3-5z"/><path d="M8 3l-1 3M16 3l1 3"/></svg>);
    case 'jacket':     return (<svg {...props}><path d="M6 5l-2 4v12h6V9l2-2 2 2v12h6V9l-2-4-4-2-4 2z"/><path d="M12 7v14"/></svg>);
    case 'towel':      return (<svg {...props}><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 8h16M4 12h16M4 16h16"/></svg>);
    case 'blanket':    return (<svg {...props}><path d="M3 5l9-2 9 2v14l-9 2-9-2z"/><path d="M12 3v18M3 12h18"/></svg>);
    case 'bag':        return (<svg {...props}><path d="M5 8h14l-1 13H6z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/></svg>);
    case 'water':      return (<svg {...props}><path d="M12 3s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>);
    case 'electric':   return (<svg {...props}><path d="M13 2L4 14h7l-2 8 9-12h-7z"/></svg>);
    case 'fuel':       return (<svg {...props}><rect x="4" y="4" width="10" height="16" rx="1"/><path d="M14 9h3a2 2 0 0 1 2 2v5a2 2 0 0 1-4 0V8l-2-2"/></svg>);
    case 'pen':        return (<svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>);
    case 'wrench':     return (<svg {...props}><path d="M14.7 6.3a4 4 0 0 1 5 5L17 14l3 3-3 3-3-3-2.7 2.7a4 4 0 0 1-5-5L8 12 5 9l3-3 3 3z"/></svg>);
    case 'truck':      return (<svg {...props}><rect x="1" y="6" width="14" height="11"/><path d="M15 9h5l2 4v4h-7"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></svg>);
    case 'pickup':     return (<svg {...props}><path d="M5 12l4 4 10-10"/><path d="M5 18l4 4 10-10"/></svg>);
    case 'home':       return (<svg {...props}><path d="M3 11l9-7 9 7v10h-6v-6h-6v6H3z"/></svg>);
    case 'sms':        return (<svg {...props}><path d="M21 11a8 8 0 0 1-8 8 8 8 0 0 1-3.9-1L3 19l1-5.1A8 8 0 0 1 21 11z"/></svg>);
    case 'settings':   return (<svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>);
    case 'map':        return (<svg {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>);
    case 'rider':      return (<svg {...props}><circle cx="6" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M9 17h3v-4l5-2 2-2h-5"/></svg>);
    case 'dry':        return (<svg {...props}><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M9 13h6"/></svg>);
    case 'mpesa':      return (<svg {...props}><path d="M4 7h16v10H4z"/><path d="M4 11h16M8 7v10M12 7v10M16 7v10"/></svg>);
    case 'lock':       return (<svg {...props}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
    case 'cloud':      return (<svg {...props}><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97 6 6 0 0 0-11.66-1.4A4 4 0 0 0 6.5 19z"/></svg>);
    case 'refresh':    return (<svg {...props}><path d="M20 12a8 8 0 1 1-2.34-5.66"/><polyline points="20 3 20 8 15 8"/></svg>);
    case 'logo':       return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor"/><path d="M7 12c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="1.6" fill="#fff"/></svg>);
    default: return null;
  }
};

// ─── Buttons ──────────────────────────────────────────────────────────────
const Button = ({ kind = 'primary', size = 'md', icon, children, onClick, type = 'button', disabled, full }) => {
  const cls = `safi-btn safi-btn--${kind} safi-btn--${size}` + (full ? ' safi-btn--full' : '');
  return (
    <button className={cls} type={type} onClick={onClick} disabled={disabled}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16}/> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
};

// ─── Badges + status pills ────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    intake:    { c: 'amber',  label: 'Intake' },
    washing:   { c: 'blue',   label: 'Washing' },
    ironing:   { c: 'violet', label: 'Ironing' },
    ready:     { c: 'green',  label: 'Ready' },
    collected: { c: 'gray',   label: 'Collected' },
  };
  const m = map[status] || { c: 'gray', label: status };
  return <span className={`safi-pill safi-pill--${m.c}`}><span className="safi-pill__dot"/>{m.label}</span>;
};

const PayBadge = ({ paid, total }) => {
  if (paid >= total) return <span className="safi-pill safi-pill--green">Paid</span>;
  if (paid === 0)    return <span className="safi-pill safi-pill--red">Unpaid</span>;
  return <span className="safi-pill safi-pill--amber">Partial</span>;
};

const GroupBadge = ({ group }) => {
  const map = { student: { c: 'blue', label: 'Student' }, normal: { c: 'gray', label: 'Normal' }, corporate: { c: 'violet', label: 'Corporate' } };
  const m = map[group] || { c: 'gray', label: group };
  return <span className={`safi-tag safi-tag--${m.c}`}>{m.label}</span>;
};

const MethodBadge = ({ method }) => {
  const m = { mpesa: { c: 'green', label: 'M-Pesa' }, cash: { c: 'gray', label: 'Cash' }, bank: { c: 'blue', label: 'Bank' }, '—': { c: 'gray', label: '—' } }[method] || { c: 'gray', label: method };
  return <span className={`safi-tag safi-tag--${m.c}`}>{m.label}</span>;
};

// ─── Sidebar ──────────────────────────────────────────────────────────────
const Sidebar = ({ role, setRole, view, setView, lang, shop }) => {
  const store = useStore();
  const current = window.SAFI_STORE.getCurrentStaff();
  const [showSwitch, setShowSwitch] = useState(false);

  const items = role === 'frontdesk'
    ? [
        ['dashboard',  'nav_dashboard', 'dashboard'],
        ['new-order',  'nav_new_order', 'plus'],
        ['orders',     'nav_orders',    'list'],
        ['dispatch',   'Pickup & Delivery', 'truck'],
        ['customers',  'nav_customers', 'users'],
        ['payments',   'nav_payments',  'wallet'],
        ['expenses',   'nav_expenses',  'box'],
        ['messages',   'Messages',      'sms'],
        ['packages',   'nav_packages',  'tag'],
        ['issues',     'nav_issues',    'alert'],
      ]
    : [
        ['dashboard',  'nav_dashboard', 'dashboard'],
        ['reports',    'nav_reports',   'chart'],
        ['approvals',  'Approvals',     'lock'],
        ['payments',   'nav_payments',  'wallet'],
        ['expenses',   'nav_expenses',  'box'],
        ['dispatch',   'Pickup & Delivery', 'truck'],
        ['customers',  'nav_customers', 'users'],
        ['pricing',    'nav_pricing',   'tag'],
        ['packages',   'nav_packages',  'package'],
        ['inventory',  'nav_inventory', 'box'],
        ['messages',   'Messages',      'sms'],
        ['staff',      'nav_staff',     'staff'],
        ['issues',     'nav_issues',    'alert'],
        ['settings',   'Settings',      'settings'],
        ['data',       'Data & Backup', 'box'],
        ['cloud',      'Cloud & Updates', 'cloud'],
      ];

  return (
    <aside className="safi-side">
      <div className="safi-side__brand">
        <div className="safi-side__logo">
          <image-slot id="shop-logo" shape="circle" src={window.VAZI_LOGO_ICON || 'assets/vazi-logo-icon.png'}
                      placeholder="Drop logo"
                      style={{ width: '44px', height: '44px' }}>
          </image-slot>
        </div>
        <div>
          <div className="safi-side__name">{shop?.name || 'Vazi Safi'}</div>
          <div className="safi-side__tag">{shop?.tagline || t('appTagline', lang)}</div>
        </div>
        {/* Pending approvals badge for management */}
        {role === 'owner' && store.approvals?.filter(a => a.status === 'pending').length > 0 && (
          <button className="safi-side__pending" onClick={() => setView('approvals')} title="Pending approvals">
            {store.approvals.filter(a => a.status === 'pending').length}
          </button>
        )}
      </div>

      <div className="safi-side__roleswitch">
        <button className={`safi-side__role ${role === 'frontdesk' ? 'is-active' : ''}`} onClick={() => setRole('frontdesk')}>
          <Icon name="staff" size={14}/>{t('role_frontdesk', lang)}
        </button>
        <button className={`safi-side__role ${role === 'owner' ? 'is-active' : ''}`} onClick={() => setRole('owner')}>
          <Icon name="lock" size={14}/>{t('role_owner', lang)}
        </button>
      </div>

      <nav className="safi-side__nav">
        {items.map(([id, key, icon]) => (
          <button key={id} className={`safi-side__item ${view === id ? 'is-active' : ''}`} onClick={() => setView(id)}>
            <Icon name={icon} size={17}/><span>{key.startsWith('nav_') ? t(key, lang) : key}</span>
          </button>
        ))}
      </nav>

      <button className="safi-side__user" onClick={() => setShowSwitch(true)}>
        <span className="safi-side__avatar">{current.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
        <div className="safi-side__userinfo">
          <div className="safi-side__username">{current.name}</div>
          <div className="safi-side__userrole">{current.role} · tap to switch</div>
        </div>
        <span className="safi-side__bell" title="Switch attendant"><Icon name="arrow" size={14}/></span>
      </button>

      <Modal open={showSwitch} onClose={() => setShowSwitch(false)} title="Switch attendant" width={420}
        footer={<Button kind="ghost" onClick={() => setShowSwitch(false)}>Done</Button>}>
        <p className="safi-cell-sub" style={{ marginTop: 0 }}>Choose who is at the front desk now. Their name will appear on every receipt.</p>
        <div className="safi-staff-pick">
          {store.staff.filter(s => s.active).map(s => (
            <button key={s.id} className={`safi-staff-pick__item ${current.id === s.id ? 'is-active' : ''}`}
              onClick={() => { window.SAFI_STORE.setCurrentStaff(s.id); setShowSwitch(false); toast(`Signed in as ${s.name}`); }}>
              <span className="safi-cust-pick__avatar safi-cust-pick__avatar--lg">{s.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span>
              <div>
                <b>{s.name}</b>
                <span>{s.role} · {s.shift}</span>
              </div>
              {current.id === s.id && <Icon name="check" size={16}/>}
            </button>
          ))}
        </div>
        <p className="safi-cell-sub" style={{ marginTop: 14, fontSize: 11 }}>Add or edit staff in <b>Owner → Staff</b>.</p>
      </Modal>
    </aside>
  );
};

// ─── Topbar ───────────────────────────────────────────────────────────────
const Topbar = ({ title, subtitle, right }) => (
  <header className="safi-top">
    <div>
      <h1 className="safi-top__title">{title}</h1>
      {subtitle && <p className="safi-top__sub">{subtitle}</p>}
    </div>
    <div className="safi-top__right">{right}</div>
  </header>
);

// ─── Cards ────────────────────────────────────────────────────────────────
const Card = ({ title, action, children, pad = true, className = '' }) => (
  <section className={`safi-card ${className}`}>
    {(title || action) && (
      <header className="safi-card__hd">
        <h3>{title}</h3>
        {action}
      </header>
    )}
    <div className={pad ? 'safi-card__body' : 'safi-card__body safi-card__body--flush'}>{children}</div>
  </section>
);

const StatCard = ({ label, value, delta, deltaKind, icon, sparkline }) => (
  <div className="safi-stat">
    <div className="safi-stat__top">
      <div className="safi-stat__label">{label}</div>
      {icon && <div className="safi-stat__icon"><Icon name={icon} size={16}/></div>}
    </div>
    <div className="safi-stat__value">{value}</div>
    {delta && (
      <div className={`safi-stat__delta safi-stat__delta--${deltaKind || 'up'}`}>
        <span>{deltaKind === 'down' ? '↓' : '↑'} {delta}</span>
      </div>
    )}
    {sparkline}
  </div>
);

// ─── Sparkline / mini-chart ───────────────────────────────────────────────
const Sparkline = ({ data, width = 120, height = 36, stroke = 'var(--brand)', fill = 'var(--brand-soft)' }) => {
  if (!data || !data.length) return null;
  const vals = data.map(d => d.v ?? d);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = width / (vals.length - 1 || 1);
  const pts = vals.map((v, i) => [i * stepX, height - 4 - ((v - min) / range) * (height - 8)]);
  const line = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg className="safi-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={area} fill={fill} opacity=".5"/>
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// Bar chart (vertical)
const BarChart = ({ data, height = 200, valueKey = 'v', labelKey = 'd' }) => {
  const max = Math.max(...data.map(d => d[valueKey]));
  return (
    <div className="safi-bars" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="safi-bars__col" title={`${d[labelKey]}: ${d[valueKey].toLocaleString()}`}>
          <div className="safi-bars__bar" style={{ height: `${(d[valueKey] / max) * 100}%` }}>
            <span className="safi-bars__val">{(d[valueKey] / 1000).toFixed(1)}k</span>
          </div>
          <div className="safi-bars__lbl">{d[labelKey]}</div>
        </div>
      ))}
    </div>
  );
};

// Donut chart
const Donut = ({ data, size = 180, thickness = 22 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="safi-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness}/>
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={`var(--donut-${i})`} strokeWidth={thickness}
              strokeDasharray={dash} strokeDashoffset={-offset}
              transform={`rotate(-90 ${size/2} ${size/2})`}/>
          );
          offset += len;
          return el;
        })}
        <text x="50%" y="48%" textAnchor="middle" className="safi-donut__num">{total.toLocaleString()}</text>
        <text x="50%" y="62%" textAnchor="middle" className="safi-donut__lbl">KES total</text>
      </svg>
      <ul className="safi-donut__legend">
        {data.map((d, i) => (
          <li key={i}><span className="safi-donut__chip" style={{ background: `var(--donut-${i})` }}/>{d.label} <b>{d.pct}%</b></li>
        ))}
      </ul>
    </div>
  );
};

// Horizontal bar (by-service)
const HBar = ({ data, max }) => {
  const m = max || Math.max(...data.map(d => d.value));
  return (
    <ul className="safi-hbar">
      {data.map((d, i) => (
        <li key={i}>
          <span className="safi-hbar__lbl">{d.label}</span>
          <span className="safi-hbar__track"><span className="safi-hbar__fill" style={{ width: `${(d.value / m) * 100}%` }}/></span>
          <span className="safi-hbar__val">{d.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
};

// ─── Tables ───────────────────────────────────────────────────────────────
const Table = ({ cols, rows, onRow, empty }) => (
  <div className="safi-table-wrap">
    <table className="safi-table">
      <thead>
        <tr>{cols.map((c, i) => <th key={i} style={c.style}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={cols.length} className="safi-table__empty">{empty || 'No data'}</td></tr>
        ) : rows.map((r, i) => (
          <tr key={i} onClick={() => onRow && onRow(r)} className={onRow ? 'is-clickable' : ''}>
            {cols.map((c, j) => <td key={j} style={c.style}>{c.render ? c.render(r) : r[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Empty / placeholder image ────────────────────────────────────────────
const Placeholder = ({ label, w = 120, h = 80 }) => (
  <div className="safi-ph" style={{ width: w, height: h }}>
    <span className="safi-ph__lbl">{label}</span>
  </div>
);

// ─── Export ───────────────────────────────────────────────────────────────
Object.assign(window, {
  // contexts
  ThemeCtx, useTheme,
  // hooks
  useStore,
  // utils
  fmtMoney, t, toast,
  // primitives
  Icon, Button, StatusBadge, PayBadge, GroupBadge, MethodBadge,
  Sidebar, Topbar, Card, StatCard,
  Sparkline, BarChart, Donut, HBar,
  Table, Placeholder, Modal, ToastHost,
  PhoneInput, PHONE_PREFIXES, IconPicker, ICON_LIBRARY, formatPhone,
});
