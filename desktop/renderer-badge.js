// Injected by main.js after load. Proof the shell is live + a hardware test tray.
// Kept out of the web app's own files so the browser build stays unchanged.
(() => {
  if (!window.lms || document.getElementById('lms-desktop-badge')) return;
  const el = document.createElement('div');
  el.id = 'lms-desktop-badge';
  el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:99999;display:flex;flex-direction:column;gap:6px;align-items:flex-end;font:11px/1.3 system-ui,sans-serif';
  el.innerHTML = '<div style="display:flex;gap:6px;align-items:center;background:#111827;color:#fff;padding:6px 10px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.28)"><span id="lms-net" style="width:7px;height:7px;border-radius:50%;background:#22c55e"></span><span id="lms-lbl">Desktop</span><button id="lms-hw" style="all:unset;cursor:pointer;padding:2px 8px;border-radius:999px;background:#374151;color:#fff;font-size:10px">Hardware</button></div><div id="lms-tray" style="display:none;flex-direction:column;gap:4px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.16)"></div>';
  document.body.appendChild(el);

  const net = el.querySelector('#lms-net');
  const paint = () => { net.style.background = navigator.onLine ? '#22c55e' : '#ef4444'; net.title = navigator.onLine ? 'Online' : 'Offline — queue writes locally'; };
  addEventListener('online', paint); addEventListener('offline', paint); paint();

  window.lms.info().then(i => { el.querySelector('#lms-lbl').textContent = `Desktop v${i.version}${i.kiosk ? ' · kiosk' : ''}`; });

  const tray = el.querySelector('#lms-tray');
  const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'all:unset;cursor:pointer;padding:5px 9px;border-radius:6px;background:#f3f4f6;color:#111827;font:11px system-ui;text-align:left'; b.onclick = fn; tray.appendChild(b); return b; };
  btn('Print test receipt', () => window.lms.printTest());
  btn('Open cash drawer', () => window.lms.openDrawer());
  btn('List printers', async () => { const p = await window.lms.printers(); alert(p.length ? p.map(x => '• ' + (x.displayName || x.name)).join('\n') : 'No printers found'); });
  el.querySelector('#lms-hw').onclick = () => { tray.style.display = tray.style.display === 'none' ? 'flex' : 'none'; };

  // ── Update-ready banner (all screens, pulses until installed) ──
  if (!document.getElementById('lms-upd-css')) {
    const st = document.createElement('style'); st.id = 'lms-upd-css';
    st.textContent = '@keyframes lmsPulse{0%,100%{background:#0f766e}50%{background:#14b8a6}}' +
      '#lms-upd{position:fixed;top:0;left:0;right:0;z-index:99998;display:none;align-items:center;justify-content:center;gap:14px;padding:8px 16px;color:#fff;font:600 14px/1.3 system-ui,sans-serif;animation:lmsPulse 1.6s ease-in-out infinite;box-shadow:0 2px 10px rgba(0,0,0,.2)}' +
      '#lms-upd button{all:unset;cursor:pointer;background:#fff;color:#0f766e;padding:6px 14px;border-radius:999px;font:700 13px system-ui,sans-serif}' +
      '#lms-upd .lms-upd-x{background:transparent;color:#fff;padding:6px 8px;font-weight:500;text-decoration:underline}' +
      'body.lms-upd-on{padding-top:42px}';
    document.head.appendChild(st);
  }
  const bar = document.createElement('div'); bar.id = 'lms-upd';
  bar.innerHTML = '<span id="lms-upd-t"></span><button id="lms-upd-go">Install and restart</button><button class="lms-upd-x" id="lms-upd-later">Later</button>';
  document.body.appendChild(bar);
  let hiddenFor = null;
  const show = (s) => {
    const on = s && s.state === 'ready' && hiddenFor !== s.version;
    bar.style.display = on ? 'flex' : 'none';
    document.body.classList.toggle('lms-upd-on', !!on);
    if (on) bar.querySelector('#lms-upd-t').textContent = `Update ${s.version} is ready`;
  };
  bar.querySelector('#lms-upd-go').onclick = () => window.lms.installUpdate();
  // "Later" hides it for 30 minutes, then it comes back.
  bar.querySelector('#lms-upd-later').onclick = async () => {
    const s = await window.lms.updateStatus(); hiddenFor = s && s.version; show(s);
    setTimeout(async () => { hiddenFor = null; show(await window.lms.updateStatus()); }, 30 * 60 * 1000);
  };
  window.lms.onUpdate(show);
  window.lms.updateStatus().then(show).catch(() => {});
})();
