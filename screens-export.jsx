// Vazi Safi — Export centre: any report as CSV or PDF, for a month or a date range.
// The PDF is printed through the browser's print dialog ("Save as PDF"); its file name
// comes from document.title, so we set it to e.g. "Vazi Safi - Orders - 2026-10".
const { useState: useStateExp } = React;

const EXP_SETS = [
  ['orders', 'Orders'], ['customers', 'Customers list'], ['payments', 'Payments'],
  ['reconciled', 'Verified & reconciled payments'], ['expenses', 'Expenses'], ['audit', 'Audit log'],
];

function expBuild(D, kind, from, to) {
  const inR = (d) => { const k = String(d || '').slice(0, 10); return k >= from && k <= to; };
  const cust = (id) => D.customers.find(c => c.id === id) || {};
  const phone = (c) => c.phone ? `${c.prefix || '+254'} ${c.phone}` : '';
  const svc = (id) => (D.services.find(s => s.id === id) || {}).name || id;
  const staff = (id) => id === 'management' ? 'Management' : ((D.staff || []).find(s => s.id === id) || {}).name || id || '';
  const dm = (s) => { const v = String(s || ''); return v.length >= 10 ? `${v.slice(8, 10)}-${v.slice(5, 7)}-${v.slice(2, 4)}${v.length >= 16 ? ' ' + v.slice(11, 16) : ''}` : v; };
  const K = (n) => Math.round(n || 0);
  if (kind === 'orders') {
    const list = D.orders.filter(o => inR(o.in)).sort((a, b) => String(a.in).localeCompare(String(b.in)));
    const day = {}; list.forEach(o => { const k = String(o.in).slice(0, 10); day[k] = (day[k] || 0) + (o.total || 0); });
    const rows = list.map(o => { const c = cust(o.customer); return [orderNo(o.id), dm(o.in), c.name || '', phone(c), c.group || '', c.location || '',
      (o.items || []).map(it => `${svc(it.svc)}${it.subtype ? ' · ' + it.subtype : ''} x${it.qty}`).join('; '),
      K(o.total), K(o.paid), K(Math.max(0, (o.total || 0) - (o.paid || 0))), o.status, staff(o.cashier), K(day[String(o.in).slice(0, 10)])]; });
    const T = list.reduce((s, o) => s + (o.total || 0), 0), P = list.reduce((s, o) => s + (o.paid || 0), 0);
    return { head: ['Order', 'Date', 'Customer', 'Phone', 'Tier', 'Residence', 'Items', 'Total', 'Paid', 'Balance', 'Status', 'Taken by', 'Day total'], rows, money: [7, 8, 9, 12],
      summary: [['Orders', list.length], ['Total', `KES ${K(T).toLocaleString()}`], ['Paid', `KES ${K(P).toLocaleString()}`], ['Unpaid', `KES ${K(T - P).toLocaleString()}`]] };
  }
  if (kind === 'customers') {
    const list = [...D.customers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const rows = list.map(c => { const os = D.orders.filter(o => o.customer === c.id); const inP = os.filter(o => inR(o.in));
      return [c.name || '', phone(c), c.group || '', c.location || '', c.joined || '', os.length, K(os.reduce((s, o) => s + (o.total || 0), 0)), inP.length, K(inP.reduce((s, o) => s + (o.total || 0), 0)), K(os.reduce((s, o) => s + Math.max(0, (o.total || 0) - (o.paid || 0)), 0))]; });
    return { head: ['Name', 'Phone', 'Tier', 'Residence', 'Joined', 'Orders (all)', 'Spend (all)', 'Orders in period', 'Spend in period', 'Owes'], rows, money: [6, 8, 9],
      summary: [['Customers', list.length], ['Active in period', rows.filter(r => r[7] > 0).length]] };
  }
  if (kind === 'payments' || kind === 'reconciled') {
    let list = (D.payments || []).filter(p => inR(p.date));
    if (kind === 'reconciled') list = list.filter(p => p.verified);
    list = list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const rows = list.map(p => { const d = p.stmtAmount == null ? '' : K(p.stmtAmount - p.amount);
      return [dm(p.date), orderNo(p.order), p.customer || '', p.method === 'bank' ? 'Bank' : 'M-Pesa', p.txn || '', K(p.amount), p.verified ? 'Verified' : 'Unverified',
        p.verifiedBy === 'manual' ? 'Manual (PIN)' : p.verifiedBy === 'statement' ? 'Statement' : (p.verified ? 'Yes' : ''), p.stmtAmount == null ? '' : K(p.stmtAmount), d === '' ? '' : (d > 0 ? '+' + d : String(d))]; });
    const tot = (f) => K(list.filter(f).reduce((s, p) => s + p.amount, 0)).toLocaleString();
    return { head: ['Date', 'Order', 'Customer', 'Method', 'Code', 'Amount', 'Status', 'Verified by', 'Statement amount', 'Difference'], rows, money: [5, 8],
      summary: [['Payments', list.length], ['M-Pesa', `KES ${tot(p => p.method !== 'bank')}`], ['Bank', `KES ${tot(p => p.method === 'bank')}`], ['Verified', `KES ${tot(p => p.verified)}`], ['Unverified', `KES ${tot(p => !p.verified)}`]] };
  }
  if (kind === 'expenses') {
    const list = (D.expenses || []).filter(e => inR(e.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const cat = (id) => ((D.expenseCategories || []).find(c => c.id === id) || {}).name || id;
    const grp = (e) => window.costGroupOf ? window.costGroupOf(D, e) : 'operational';
    const rows = list.map(e => [dm(e.date), cat(e.category), e.label || '', grp(e) === 'special' ? 'Special' : 'Operational', K(e.amount), e.method === 'bank' ? 'Bank' : e.method === 'mpesa' ? 'M-Pesa' : (e.method || ''), e.txn || '', staff(e.paidBy), (e.linkedOrder || '').split(',').filter(Boolean).map(orderNo).join(' '), e.notes || '']);
    const A = list.reduce((s, e) => s + e.amount, 0), O = list.filter(e => grp(e) !== 'special').reduce((s, e) => s + e.amount, 0);
    return { head: ['Date', 'Category', 'Description', 'Group', 'Amount', 'Method', 'Code', 'Logged by', 'Linked orders', 'Notes'], rows, money: [4],
      summary: [['Entries', list.length], ['Total', `KES ${K(A).toLocaleString()}`], ['Operational', `KES ${K(O).toLocaleString()}`], ['Special', `KES ${K(A - O).toLocaleString()}`]] };
  }
  const list = (D.auditLog || []).filter(a => inR(SAFI_TIME.day(new Date(a.at)))).slice().reverse();
  const rows = list.map(a => [dm(SAFI_TIME.stamp(new Date(a.at))), staff(a.staff), a.action, a.target ? orderNo(a.target) : '', a.detail || '']);
  return { head: ['When', 'Who', 'Action', 'Order / item', 'Detail'], rows, money: [], summary: [['Entries', list.length]] };
}

function expCSV(b) {
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [b.head.join(','), ...b.rows.map(r => r.map(cell).join(','))].join('\n');
}

function expPDF(b, title, sub, shop) {
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const old = document.getElementById('safi-export-print'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'safi-export-print';
  el.innerHTML = `<div class="xp-hd"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="xp-shop">${esc(shop || 'Vazi Safi Laundry & Executive Dry Cleaners')}</div></div>
    <div class="xp-sum">${b.summary.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <table><thead><tr>${b.head.map((h, i) => `<th${b.money.includes(i) ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${b.rows.map(r => `<tr>${r.map((c, i) => `<td${b.money.includes(i) ? ' class="n"' : ''}>${esc(b.money.includes(i) && c !== '' && !isNaN(c) ? Number(c).toLocaleString() : c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${b.head.length}">Nothing in this period.</td></tr>`}</tbody></table>
    <p class="xp-ft">Generated ${esc(dmyT(new Date()))}</p>`;
  document.body.appendChild(el);
  const prevTitle = document.title;
  document.title = title;
  document.body.classList.add('safi-exporting');
  const done = () => { document.body.classList.remove('safi-exporting'); document.title = prevTitle; el.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(() => { if (document.body.classList.contains('safi-exporting')) done(); }, 1500); }, 60);
}

function ExportCenter() {
  const D = useStore();
  const [kind, setKind] = useStateExp('orders');
  const [mode, setMode] = useStateExp('month');
  const [month, setMonth] = useStateExp(SAFI_TIME.day().slice(0, 7));
  const [from, setFrom] = useStateExp(SAFI_TIME.daysAgo(29));
  const [to, setTo] = useStateExp(SAFI_TIME.day());
  const [f, t] = mode === 'month' ? [`${month}-01`, `${month}-31`] : mode === 'all' ? ['0000-00-00', '9999-12-31'] : [from, to];
  const label = (EXP_SETS.find(x => x[0] === kind) || [])[1];
  const periodTxt = mode === 'month' ? month : mode === 'all' ? 'All time' : `${from} to ${to}`;
  const name = `Vazi Safi - ${label} - ${periodTxt}`.replace(/[\\/:*?"<>|]/g, '-');
  const b = expBuild(D, kind, f, t);
  const csv = () => { const blob = new Blob(['\ufeff' + expCSV(b)], { type: 'text/csv' }); const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); toast(`Saved ${name}.csv`); };
  const pdf = () => expPDF(b, name, `${label} · ${periodTxt} · ${b.rows.length} rows`, (D.settings || {}).shopName);
  return (
    <Card title="Export reports (CSV or PDF)" action={<span className="safi-cell-sub">{b.rows.length} rows · file: <b>{name}</b></span>}>
      <div className="safi-xp">
        <div className="safi-xp__sets">
          {EXP_SETS.map(([k, l]) => <button key={k} className={`safi-chip ${kind === k ? 'is-active' : ''}`} onClick={() => setKind(k)}>{l}</button>)}
        </div>
        <div className="safi-xp__row">
          <div className="safi-seg">{[['month', 'Month'], ['range', 'Date range'], ['all', 'All time']].map(([k, l]) => <button key={k} className={`safi-seg__btn ${mode === k ? 'is-active' : ''}`} onClick={() => setMode(k)}>{l}</button>)}</div>
          {mode === 'month' && <input type="month" className="safi-input" style={{ width: 'auto' }} value={month} max={SAFI_TIME.day().slice(0, 7)} onChange={e => setMonth(e.target.value || month)}/>}
          {mode === 'range' && <><input type="date" className="safi-input" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)}/><span className="safi-cell-sub">to</span><input type="date" className="safi-input" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)}/></>}
          <span style={{ flex: 1 }}/>
          <Button kind="ghost" icon="box" onClick={csv}>Download CSV</Button>
          <Button kind="primary" icon="print" onClick={pdf}>Save as PDF</Button>
        </div>
        <div className="safi-xp__sum">{b.summary.map(([k, v]) => <div key={k}><span>{k}</span><b className="safi-mono">{v}</b></div>)}</div>
        <p className="safi-hint" style={{ margin: 0 }}>Save as PDF opens the print window: choose <b>Save as PDF</b> as the printer. The file name is filled in for you.</p>
      </div>
    </Card>
  );
}

Object.assign(window, { ExportCenter, expPDF });

// ─── Minimal .xlsx writer (no library; works offline) ───────────────────────
// Builds a real Excel workbook: one sheet, header row bold, numbers kept as numbers.
window.safiXlsx = (fileName, sheetName, head, rows) => {
  const enc = new TextEncoder();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const cell = (v, r, c, bold) => { const ref = col(c) + (r + 1); if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${bold ? ' s="1"' : ''}><v>${v}</v></c>`; return `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(v == null ? '' : v)}</t></is></c>`; };
  const all = [head, ...rows];
  const widths = head.map((_, c) => Math.min(40, Math.max(8, ...all.map(r => String(r[c] == null ? '' : r[c]).length + 2))));
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols><sheetData>' + all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cell(v, ri, ci, ri === 0)).join('')}</row>`).join('') + '</sheetData></worksheet>';
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(String(sheetName || 'Sheet1').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>'],
    ['xl/worksheets/sheet1.xml', sheet],
  ];
  // ZIP (stored, no compression)
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const parts = [], central = []; let off = 0;
  const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const [name, text] of files) {
    const nb = enc.encode(name), db = enc.encode(text), c = crc(db);
    const lh = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(c), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0)]);
    parts.push(lh, nb, db);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(c), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += lh.length + nb.length + db.length;
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  const blob = new Blob([...parts, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
};
