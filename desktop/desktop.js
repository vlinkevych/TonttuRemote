// PC app windows (design v2, design/pc-ui-v2): ?screen=app (sidebar + pages), ?screen=qr (QR code
// window), ?screen=dialog (approvals). The host (DesktopWindow.cs) pushes {type:'state'} and
// {type:'nav'} and answers {type:'reply'} to postMessage commands. Without a host (a phone opening
// /help) only Help runs, as a web page.
(() => {
  'use strict';

  const host = window.chrome && window.chrome.webview;
  const web = !host;
  const params = new URLSearchParams(location.search);
  const screen = web ? 'web' : (params.get('screen') || 'app');
  const app = document.getElementById('app');
  const APP = document.body.dataset.app || 'Tonttu';
  document.body.classList.toggle('web', web);
  document.body.classList.add('s-' + screen);

  let S = { pcName: document.body.dataset.pc || '', feedbackEmail: document.body.dataset.feedback || '' }; // state from the host
  const L = { page: web ? 'help' : null, q: '', art: null, devSel: undefined, ftype: 'problem', diag: false, msg: '', email: '', rating: 0, allowPublish: false, pubName: '', step: 1 };

  // ---- host bridge ----
  let rid = 0;
  const waiting = {};
  function call(cmd, args) {
    if (!host) return Promise.resolve({ ok: false });
    // "rid", not "id": commands about a device carry the device's own "id".
    const r = ++rid;
    host.postMessage(Object.assign({}, args || {}, { cmd, rid: r }));
    return new Promise((resolve) => { waiting[r] = resolve; });
  }
  if (host) {
    host.addEventListener('message', (e) => {
      const m = e.data;
      if (m.type === 'reply') {
        const r = waiting[m.rid];
        delete waiting[m.rid];
        if (r) r(m);
      } else if (m.type === 'state') {
        S = Object.assign({}, S, m.data);
        render();
      } else if (m.type === 'nav') {
        if (m.tab) L.certTab = m.tab; // screenshots: open the Certificate page on a given device tab
        go(m.page);
      }
    });
  }

  // ---- helpers ----
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const P = {
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h3v3"/>',
    shieldCheck: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    shieldAlert: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M12 8v5M12 16v.01"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>', chevD: '<path d="M6 9l6 6 6-6"/>', chevU: '<path d="M6 15l6-6 6 6"/>', chevL: '<path d="M15 6l-6 6 6 6"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>', arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    wifi: '<path d="M2 9.5a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01"/>',
    wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.6-3M10.7 5.1A15 15 0 0 1 22 9.5M12 20h.01"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    folderOpen: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1"/><path d="M3 7v10a2 2 0 0 0 2 2h12.5a2 2 0 0 0 1.9-1.4l2-6A1.5 1.5 0 0 0 20 10H8a2 2 0 0 0-1.9 1.4L3 19"/>',
    zip: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M10 6h2M10 10h2M10 14h2v3h-2z"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    tablet: '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    computer: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    linkOff: '<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 4 8M8 12h3M3 3l18 18"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    sendFile: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    searchOff: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    touch: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11M12 10V9a1.5 1.5 0 0 1 3 0v2M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 15.5a1.5 1.5 0 0 1 2.5-1.6L9 16"/>',
    slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8M10 8l4 2-4 2z"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    devices: '<rect x="2" y="5" width="13" height="10" rx="1.5"/><path d="M6 19h5"/><rect x="17" y="8" width="5" height="11" rx="1.2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5L4 12z"/>',
    android: '<path d="M7 10h10v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM7 10a5 5 0 0 1 10 0M9 6.5L8 5M15 6.5l1-1.5M4.5 11v4M19.5 11v4"/>',
  };
  const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
  const kindIcon = (k) => (k === 'tablet' ? 'tablet' : k === 'computer' ? 'computer' : 'phone');
  const toggle = (on, act, label, arg, disabled) =>
    `<button class="toggle" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" data-act="${act}"${arg != null ? ` data-arg="${esc(arg)}"` : ''}${disabled ? ' disabled' : ''}></button>`;
  const seg = (opts, cur, act, label, cls) => `<div class="seg ${cls || ''}" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v, t]) => `<button role="radio" aria-checked="${v === cur}" data-act="${act}" data-arg="${v}">${t}</button>`).join('')}</div>`;
  const appIcon = (px) => `<span class="app-icon" style="width:${px}px;height:${px}px;border-radius:${Math.round(px * 0.27)}px"></span>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const steps = (list) => `<div class="steps">${list.map((t, i) => `<div class="step"><span class="step-n">${i + 1}</span><span class="step-t">${esc(t)}</span></div>`).join('')}</div>`;
  const qrTile = (src, px, dim, logo) => `<div class="qr-tile${dim ? ' dim' : ''}">${src ? `<img src="${src}" alt="QR code" style="width:${px}px;height:${px}px">` : `<div style="width:${px}px;height:${px}px"></div>`}${logo ? `<span class="logo app-icon" style="width:${Math.round(px * 0.205)}px;height:${Math.round(px * 0.205)}px"></span>` : ''}</div>`;
  function statusPill() {
    const st = S.status || 'ok';
    const p = st === 'error' ? ['tone-red', 'Not running'] : st === 'offline' ? ['tone-sub', 'Offline'] : st === 'public' ? ['tone-amber', 'Blocked']
      : S.connected > 0 ? ['tone-green', `${S.connected} connected`] : ['tone-sub', 'Waiting for a device'];
    return `<span class="pill ${p[0]}"><span class="dot"></span><span${p[0] === 'tone-sub' ? ' class="tone-sub2"' : ''}>${p[1]}</span></span>`;
  }
  function empty(icon, tone, title, text, actions, extra) {
    return `<div class="empty"><span class="empty-ic ${tone}">${ic(icon)}</span>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:center"><span class="empty-title">${title}</span><span class="empty-text">${text}</span></div>
      ${actions ? `<div class="empty-actions">${actions}</div>` : ''}${extra || ''}</div>`;
  }
  function offlineOrError() {
    if (S.status === 'offline') return empty('wifiOff', '', 'No network connection', "Connect this computer to Wi-Fi or a network cable. The code appears as soon as it's online.", '<button class="btn secondary md" data-act="netSettings">Network settings</button>', '<button class="btn link" data-act="article" data-arg="cant">Device can\'t connect?</button>');
    if (S.status === 'error') return empty('alert', 'red', "Devices can't reach this computer", `${esc(S.error || '')} Close programs you don't need and try again, or restart the computer.`, '<button class="btn primary md" data-act="retry">Try again</button><button class="btn secondary md" data-act="openFolder" data-arg="logs">Open log folder</button>');
    return null;
  }
  function publicBanner(compact) {
    if (S.status !== 'public') return '';
    return `<div class="banner">${ic('shieldAlert')}<div class="banner-body">
      <span class="sub2"${compact ? ' style="font-size:12.5px"' : ''}><span class="strong">Devices are blocked.</span> Windows marks “${esc(S.networkName || 'this network')}” as Public, so the firewall stops devices${compact ? '' : ' from connecting'}.</span>
      <div class="banner-actions"><button class="btn primary" data-act="makePrivate"${L.busy ? ' disabled' : ''}>Mark as Private</button>
        <button class="btn secondary" data-act="netSettings">Network settings${ic('ext')}</button>
        <button class="btn link" data-act="allowPublic"${L.busy ? ' disabled' : ''}>Allow on public networks</button></div>
      ${L.netError ? `<span class="error-line">${esc(L.netError)}</span>` : ''}</div></div>`;
  }
  const renewCard = () => `<div class="confirm-card"><div class="row-text"><span style="font:600 13px var(--sans)">Make a new code?</span><span class="sub small">Devices already paired keep working. New devices need the new code.</span></div>
    <div class="actions"><button class="btn secondary default" data-act="cancelRenew" data-autofocus="renew">Cancel</button><button class="btn primary" data-act="renew">New code</button></div></div>`;
  const copyBtn = (label) => `<button class="btn secondary${L.copied ? ' done' : ''}" data-act="copyLink" title="Copies the full link, with the pairing code">${ic(L.copied ? 'check' : 'copy')}${L.copied ? 'Copied' : label}</button>`;

  // ---- rendering: whole view re-rendered on every change, keeping scroll and focus ----
  let lastAutofocus = '';
  function render() {
    const sc = app.querySelector('.scroll');
    const top = sc ? sc.scrollTop : 0;
    const a = document.activeElement;
    const k = a && a.dataset ? a.dataset.k : null;
    const caret = a && a.selectionStart != null ? a.selectionStart : null;
    app.innerHTML = screen === 'qr' ? qrWindow() : screen === 'dialog' ? dialog() : screen === 'web' ? webHelp() : appWindow();
    const sc2 = app.querySelector('.scroll');
    if (sc2 && !L.scrollTop) sc2.scrollTop = top;
    L.scrollTop = false;
    const keep = k && app.querySelector(`[data-k="${k}"]`);
    if (keep) {
      keep.focus();
      if (caret != null && keep.setSelectionRange) keep.setSelectionRange(caret, caret);
    } else {
      const af = app.querySelector('[data-autofocus]');
      const key = af ? af.dataset.autofocus : '';
      if (af && key !== lastAutofocus) af.focus();
      lastAutofocus = key;
    }
    if (document.body.classList.contains('auto')) requestAnimationFrame(() => call('resize', { height: Math.ceil(app.scrollHeight) }));
  }

  // ---- actions (data-act on clickable elements) ----
  const A = {};
  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled || !app.contains(el)) return;
    const f = A[el.dataset.act];
    if (f) { e.preventDefault(); f(el.dataset.arg, el); }
  });
  app.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.input && A[el.dataset.input]) A[el.dataset.input](el.value, el);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); A.escape(); }
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter && A[e.target.dataset.enter]) { e.preventDefault(); A[e.target.dataset.enter](); }
  });
  document.addEventListener('contextmenu', (e) => { if (!web && !e.target.closest('input, textarea')) e.preventDefault(); });

  A.openUrl = (url) => call('openUrl', { url });
  A.openFolder = (which) => call('openFolder', { which });
  A.show = (which) => call('show', { which });
  A.netSettings = () => call('networkSettings');
  A.retry = () => call('retry');
  A.copyLink = () => {
    call('copy', { text: S.url });
    L.copied = true; render();
    clearTimeout(L.copyTimer);
    L.copyTimer = setTimeout(() => { L.copied = false; render(); }, 1600);
  };
  A.askRenew = () => { L.renew = true; render(); };
  A.cancelRenew = () => { L.renew = false; render(); };
  A.renew = () => { L.renew = false; call('newCode'); render(); };
  async function netAction(cmd) {
    L.busy = true; L.netError = ''; render();
    const r = await call(cmd);
    L.busy = false;
    if (!r.ok) L.netError = r.error || "That didn't work.";
    render();
  }
  A.makePrivate = () => netAction('makePrivate');
  A.allowPublic = () => netAction('allowPublic');

  // ======================= App window =======================
  const NAV = [['connect', 'Connect', 'qr'], ['certificate', 'Certificate', 'shieldCheck'], ['devices', 'Devices', 'devices'], ['settings', 'Settings', 'settings'], ['help', 'Help', 'help']];
  function currentPage() {
    if (S.welcomeDone === false) return 'welcome';
    return L.page && L.page !== 'welcome' ? L.page : 'connect';
  }
  function go(page) {
    if (!page) return;
    L.page = page; L.art = null; L.fres = null; L.renaming = false; L.reset = false; L.renew = false; L.scrollTop = true;
    if (page !== 'welcome') call('page', { page });
    render();
  }
  A.go = (page) => go(page);
  A.article = (id) => { L.page = 'help'; L.art = id; L.scrollTop = true; render(); };

  function appWindow() {
    const page = currentPage();
    if (page === 'welcome') return `<div class="win"><main class="main full scroll">${welcome()}</main></div>`;
    const navPage = page;
    const nav = (id, label, icon, extra, cls) => `<button class="nav-item ${cls || ''}" data-act="go" data-arg="${id}" title="${label}"${navPage === id ? ' aria-current="page"' : ''}>${ic(icon)}<span class="lbl">${label}</span>${extra || ''}</button>`;
    const count = (S.devices || []).filter((d) => d.status === 'connected').length;
    const items = NAV.map(([id, label, icon]) => nav(id, label, icon, id === 'devices' && count ? `<span class="badge"><span class="dot"></span>${count}</span><span class="rail-dot"></span>` : ''));
    // Feedback has its own entry while the app is in beta (the beta notice says "tell us"); it folds back into Help later.
    const foot = nav('feedback', 'Feedback', 'chat', '', 'foot')
      + (S.supportUrl ? `<button class="nav-item foot quiet" data-act="openUrl" data-arg="${esc(S.supportUrl)}" title="Support the developer">${ic('heart')}<span class="lbl">Support the developer</span></button>` : '')
      + nav('about', 'About', 'info', `<span class="meta">${esc(S.version || '')}</span>`, 'foot');
    const body = { connect, certificate, devices, settings, help, feedback, about }[page] || connect;
    return `<div class="win"><nav class="nav">${items.join('')}<div style="flex:1"></div>${foot}</nav>
      <main class="main"><div class="page scroll">${page === 'settings' ? '' : updateBanner()}${body()}</div></main></div>${page === 'devices' && L.reset ? resetModal() : ''}`;
  }

  // ---- Connect ----
  function connect() {
    const head = `<div class="page-head"><div class="row-text"><span class="h-page">Connect a device</span><span class="sub">Scan the code with the camera of your phone or tablet. The remote opens in its browser, so there's nothing to install.</span></div>${statusPill()}</div>`;
    const off = offlineOrError();
    if (off) return head + off;
    const blocked = S.status === 'public';
    const px = blocked ? 164 : 196;
    const phones = S.phones || [];
    const right = (phones.length
      ? `<div class="card" style="padding:14px 16px 6px"><span class="sec-label" style="padding:0 0 4px">Connected now</span>${phones.map((p) => `<div class="phone-row"><span class="tile">${ic(kindIcon(p.kind))}</span>
          <span class="row-text" style="gap:2px"><span class="ellipsis" style="font:500 14px var(--sans)">${esc(p.name)}</span><span class="mono tone-sub" style="font-size:11px">since ${esc(p.since)}</span></span>
          <button class="btn secondary" style="height:30px;font-size:12px" data-act="disconnect" data-arg="${p.id}">Disconnect</button></div>`).join('')}</div>`
      : `<div class="card pad" style="display:flex;flex-direction:column;gap:10px"><span class="sec-label" style="padding:0">Waiting for a device</span>
          ${steps(['Open the camera on your phone or tablet.', 'Point it at the code.', 'Tap the link that appears. The remote opens in the browser.', 'The first time, click Allow on this computer.'])}
          <div style="height:1px;background:var(--line)"></div><span class="small tone-sub" style="display:flex;align-items:center;gap:8px">${ic('wifi')}The device and the computer need to be on the same Wi-Fi.</span></div>`)
      + `<div class="card pad" style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;gap:12px;align-items:flex-start"><span class="tile">${ic('shieldCheck')}</span>
          <div class="row-text"><span style="font:600 13px var(--sans)">The browser will show a security warning</span><span class="sub small">Until the certificate is installed on a phone or tablet, its browser warns when the remote opens. You can continue past it, or install the certificate once per device to stop it.</span></div></div>
          <button class="btn secondary" style="align-self:flex-start;margin-left:46px;padding-right:8px" data-act="go" data-arg="certificate">Install certificate${ic('chevR')}</button></div>
        <button class="btn link" style="align-self:flex-start;text-decoration:none;gap:6px;font-size:13px" data-act="article" data-arg="cant">${ic('help')}<span style="text-decoration:underline;text-underline-offset:3px">Device can't connect?</span></button>`;
    return head + publicBanner(false) + `<div class="grid2"><div class="qr-card">${qrTile(S.qr, px, blocked, true)}
        <div class="pc-line">${ic('computer')}${esc(S.pcName)}</div><span class="mono small tone-sub">${esc(S.displayUrl || '')}</span>
        ${L.renew ? renewCard() : `<div style="display:flex;gap:8px;margin-top:4px">${copyBtn('Copy link')}<button class="btn secondary" data-act="askRenew">${ic('refresh')}New code</button></div>`}
      </div><div class="col">${right}</div></div>`;
  }
  A.disconnect = (id) => call('disconnect', { id });

  // ---- Certificate ----
  function certificate() {
    const android = L.certTab === 'android';
    return `<div class="page-head"><div class="row-text"><span class="h-page">Certificate</span><span class="sub">Install it once on each phone or tablet to stop the browser's security warning.</span></div><span class="tag">Once per device</span></div>
      <div class="card pad" style="display:flex;flex-direction:column;gap:8px"><span class="sec-label" style="padding:0">Why it's needed</span>
        <span class="sub2" style="line-height:1.55">The connection between the device and this computer is encrypted. The certificate for it is made by this computer, not by a company the browser already knows, so the browser shows a security warning when the remote opens.</span>
        <span class="sub2" style="line-height:1.55">Installing the certificate tells the device to trust this computer. The warning goes away, the connection stays encrypted, and nothing leaves your home network.</span></div>
      <div class="grid2"><div class="qr-card" style="padding:20px 18px 18px">${android
        ? `${qrTile(S.caQr, 196, false, false)}<span style="font:600 14px var(--sans);margin-top:4px">Scan to download the certificate</span><span class="mono tone-sub wrap" style="font-size:11.5px;text-align:center">${esc(S.caFile)}</span>`
        : `${qrTile(S.certQr, 196, false, false)}<span style="font:600 14px var(--sans);margin-top:4px">Scan to download the profile</span><span class="mono tone-sub wrap" style="font-size:11.5px;text-align:center">${esc(S.profileFile)}</span>`}</div>
      <div class="card pad" style="display:flex;flex-direction:column;gap:12px">${seg([['ios', 'iPhone and iPad'], ['android', 'Android']], android ? 'android' : 'ios', 'certTab', 'Device type', 'sm')}
        ${android
          ? steps(['Scan the code with the camera. If the browser warns about the connection, tap Advanced, then Proceed; the file downloads.', 'Open Settings › Security & privacy › More security settings › Encryption & credentials (Samsung: Security and privacy › Other security settings).', `Tap Install a certificate › CA certificate, confirm Install anyway, and pick “${S.caFile || ''}” from Downloads.`, 'Done. Android may show a “network may be monitored” note: that is its standard message for any certificate you add yourself.'])
            + '<span class="sub small" style="font-size:12px">Works in Chrome and Samsung Internet. Firefox on Android does not use certificates you add yourself; continue past its warning instead.</span>'
          : steps(['Scan the code with the iPhone camera and tap Allow to download the profile.', 'Open Settings › General › VPN & Device Management.', `Tap the “${S.profileName || ''}” profile, then Install. If there's an older ${APP} profile, remove it.`, 'Open Settings › General › About › Certificate Trust Settings.', `Turn on full trust for “${S.authorityName || ''}”. Done.`])}
        <div style="display:flex;justify-content:flex-end;padding-top:4px"><button class="btn primary" style="height:34px;padding:0 18px;border-radius:11px;font-size:13px" data-act="go" data-arg="connect">Done</button></div></div></div>`;
  }
  A.certTab = (v) => { L.certTab = v; render(); };

  // ---- Devices ----
  const GROUPS = [['connected', 'Connected now', 'No device is connected.'], ['allowed', 'Allowed', 'Paired devices appear here.'], ['banned', 'Banned', 'Banned devices appear here.']];
  function devices() {
    const devs = S.devices || [];
    if (L.devSel !== undefined && L.devSel !== null && !devs.some((d) => d.id === L.devSel)) L.devSel = null;
    const sel = devs.find((d) => d.id === L.devSel) || (L.devSel === undefined ? devs[0] : null) || devs[0];
    let h = `<div class="page-head"><div class="row-text"><span class="h-page">Devices</span><span class="sub">Each browser that pairs is listed on its own. Browsers with the same Wi-Fi address are shown as one device.</span></div>
        <button class="btn danger" data-act="askReset">${ic('reset')}Reset pairing</button></div>
      <div class="card" style="display:flex;align-items:center;gap:16px;padding:12px 16px"><div class="row-text"><span class="row-label">Approve new devices on this computer</span><span class="row-sub">A new device needs a click on this computer before it can connect, as well as the code.</span></div>${toggle(S.approveNew, 'set', 'Approve new devices', 'approveNew')}</div>`;
    // One phone = the browsers seen with the same Wi-Fi address (best guess: phones can change it).
    const phones = [];
    devs.forEach((d) => { let p = phones.find((x) => x.key === d.phone); if (!p) phones.push(p = { key: d.phone, list: [] }); p.list.push(d); });
    phones.forEach((p) => { p.status = p.list.some((d) => d.status === 'connected') ? 'connected' : p.list.every((d) => d.status === 'banned') ? 'banned' : 'allowed'; });
    const meta = (d) => d.status === 'connected' ? `Since ${d.since}` : d.status === 'banned' ? `Banned ${d.bannedOn}` : `Last seen ${d.lastSeen}`;
    const row = (d, sub) => `<button class="dev-item${sub ? ' sub-item' : ''}" role="option" aria-selected="${sel && d.id === sel.id}" data-act="pick" data-arg="${d.id}" data-k="dev-${d.id}">
        ${sub ? '' : `<span class="dev-ic${d.status === 'banned' ? ' banned' : ''}">${ic(kindIcon(d.kind))}${d.status === 'connected' ? '<span class="on"></span>' : ''}</span>`}
        <span class="row-text" style="gap:1px"><span class="ellipsis" style="font:500 13px var(--sans)">${sub ? `${d.status === 'connected' ? '<span class="live-dot"></span>' : ''}${esc(d.browser || 'Browser')}` : esc(d.name)}</span>
        <span class="ellipsis tone-sub" style="font-size:11.5px">${esc(sub ? meta(d) : [d.browser, meta(d)].filter(Boolean).join(' · '))}</span></span></button>`;
    const list = GROUPS.map(([st, label, emptyText]) => {
      const items = phones.filter((p) => p.status === st);
      return `<div class="group" style="gap:4px"><span class="sec-label" style="padding:0 0 2px 4px">${label}</span>${items.length ? items.map((p) => p.list.length === 1 ? row(p.list[0], false)
          : `<div class="phone-group"><div class="dev-item" style="cursor:default"><span class="dev-ic${st === 'banned' ? ' banned' : ''}">${ic(kindIcon(p.list[0].kind))}${st === 'connected' ? '<span class="on"></span>' : ''}</span>
            <span class="row-text" style="gap:1px"><span class="ellipsis" style="font:500 13px var(--sans)">${esc(p.list[0].name)}</span><span class="ellipsis tone-sub" style="font-size:11.5px">${p.list.length} browsers</span></span></div>
            ${p.list.map((d) => row(d, true)).join('')}</div>`).join('')
        : `<span class="sub small" style="padding:2px 4px">${emptyText}</span>`}</div>`;
    }).join('');
    if (!sel) {
      return h + `<div class="grid-dev"><div class="col" style="gap:14px">${list}</div><div class="dashed">${ic('devices')}<span style="font:600 14px var(--sans)">No devices yet</span>
        <span class="sub" style="font-size:12.5px;max-width:260px">Scan the code on the Connect page with a phone or tablet. It appears here.</span><button class="btn primary" style="margin-top:4px" data-act="go" data-arg="connect">Show QR code</button></div></div>`;
    }
    const st = sel.status;
    const siblings = devs.filter((d) => d.phone === sel.phone && d.id !== sel.id);
    const pill = st === 'connected' ? ['tone-green', 'Connected'] : st === 'banned' ? ['tone-red', 'Banned'] : ['tone-sub', 'Allowed'];
    const btn = (kind, label, icon, act) => `<button class="btn ${kind}" data-act="${act}" data-arg="${sel.id}">${ic(icon)}${label}</button>`;
    const actions = st === 'connected' ? [btn('secondary', 'Disconnect', 'linkOff', 'devDisconnect'), btn('secondary', 'Remove', 'trash', 'remove'), btn('danger', 'Ban', 'ban', 'ban')]
      : st === 'banned' ? [btn('secondary', 'Unban', 'undo', 'unban'), btn('secondary', 'Remove', 'trash', 'remove')]
      : [btn('secondary', 'Remove', 'trash', 'remove'), btn('danger', 'Ban', 'ban', 'ban')];
    const perms = [['download', 'Download files from this computer', 'download'], ['send', 'Send files to this computer', 'sendFile'], ['mic', 'Use as microphone', 'mic']];
    const detail = `<div class="card detail"><div class="detail-head"><span class="big-ic">${ic(kindIcon(sel.kind))}</span><div class="row-text" style="gap:4px">
        ${L.renaming ? `<div class="rename"><input class="text-input" data-k="rename" data-input="renameVal" data-enter="saveRename" maxlength="40" value="${esc(L.renameVal)}" aria-label="Device name"><button class="btn primary" data-act="saveRename">Save</button><button class="btn ghost" data-act="cancelRename">Cancel</button></div>`
          : `<div style="display:flex;align-items:center;gap:2px;min-width:0"><span class="ellipsis" style="font:600 17px var(--sans)">${esc(sel.name)}</span><button class="icon-btn" data-act="startRename" aria-label="Rename" title="Rename">${ic('edit')}</button></div>`}
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="pill sm tone-sub2">${esc(sel.type)}</span><span class="pill sm ${pill[0]}"><span class="dot"></span><span${st === 'banned' ? '' : ' class="tone-sub2"'}>${pill[1]}</span></span></div></div></div>
      <div class="facts-line"><span>${esc([sel.browser, [sel.os, sel.osVersion].filter(Boolean).join(' '), sel.model && sel.model !== sel.name ? sel.model : ''].filter(Boolean).join(' · ') || 'Browser not known yet')}</span>
        <span class="mono tone-sub" style="font-size:11.5px">${esc(sel.addr)} · ${st === 'connected' ? `connected since ${esc(sel.since)}` : st === 'banned' ? `banned ${esc(sel.bannedOn)}` : `last seen ${esc(sel.lastSeen)}`}</span>
        ${sel.mac ? `<span class="mono tone-sub" style="font-size:11.5px" title="Usually a private address the device uses on this network. It can change.">Wi-Fi address ${esc(sel.mac)}</span>` : ''}</div>
      ${siblings.length ? `<div class="sibs"><span class="sub small">Also on this device:</span>${siblings.map((d) => `<button class="btn ghost" style="height:26px;font-size:12px" data-act="pick" data-arg="${d.id}">${esc(d.browser || 'Browser')} · ${d.status === 'connected' ? 'connected' : d.status === 'banned' ? 'banned' : 'allowed'}</button>`).join('')}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${actions.join('')}</div>
      ${st === 'banned' ? '' : `<div style="display:flex;flex-direction:column;border-top:1px solid var(--line);padding-top:4px">${perms.map(([k, label, icon]) => {
        const off = k === 'download' && S.downloadsOff;
        return `<div class="perm">${ic(icon)}<span class="row-text"><span style="font:500 13px var(--sans)">${label}</span>${off ? '<span class="row-sub">Turned off for every device in Settings › Files.</span>' : ''}</span>${toggle(sel.perms[k] && !off, 'perm', label, k, off)}</div>`;
      }).join('')}</div>`}
      <div class="note">${ic('info')}<span>${st === 'banned' ? "This device can't connect. Ban covers every browser on it and pairing from its Wi-Fi address, and it changed the pairing code. A device that changes its Wi-Fi address can ask to pair again, and you'll see the approval window."
        : `Permissions and Remove apply to this browser only; Ban applies to the whole device. Permissions are limits, not a lock: a connected device controls the mouse and keyboard, so it can reach anything on the screen.`}</span></div></div>`;
    return h + `<div class="grid-dev"><div class="col" style="gap:14px">${list}</div>${detail}</div>`;
  }
  const resetModal = () => `<div class="scrim"><div class="modal" role="dialog" aria-modal="true"><div class="row-text" style="gap:6px"><span style="font:600 16px var(--sans)">Reset pairing?</span>
      <span class="sub" style="line-height:1.55">This forgets every device and makes a new code. Each device has to scan again to connect.</span></div>
      <div class="actions"><button class="btn secondary md default" data-act="cancelReset" data-autofocus="reset">Cancel</button><button class="btn danger md" data-act="reset">Reset pairing</button></div></div></div>`;
  A.pick = (id) => { L.devSel = id; L.renaming = false; render(); };
  A.startRename = () => { const d = (S.devices || []).find((x) => x.id === (L.devSel || (S.devices[0] || {}).id)); if (!d) return; L.devSel = d.id; L.renaming = true; L.renameVal = d.name; render(); const i = app.querySelector('[data-k="rename"]'); if (i) { i.focus(); i.select(); } };
  A.renameVal = (v) => { L.renameVal = v; };
  A.cancelRename = () => { L.renaming = false; render(); };
  A.saveRename = () => {
    const name = (L.renameVal || '').trim();
    const d = (S.devices || []).find((x) => x.id === L.devSel);
    if (name && d) { d.name = name; call('rename', { id: d.id, name }); }
    L.renaming = false; render();
  };
  A.devDisconnect = (id) => call('disconnect', { id });
  A.remove = (id) => { L.devSel = null; call('remove', { id }); };
  A.ban = (id) => call('ban', { id });
  A.unban = (id) => call('unban', { id });
  A.perm = (key, el) => {
    const value = el.getAttribute('aria-checked') !== 'true';
    const d = (S.devices || []).find((x) => x.id === (L.devSel || (S.devices[0] || {}).id));
    if (!d) return;
    d.perms[key] = value; render();
    call('perm', { id: d.id, key, value });
  };
  A.askReset = () => { L.reset = true; render(); };
  A.cancelReset = () => { L.reset = false; render(); };
  A.reset = () => { L.reset = false; L.devSel = null; render(); call('resetPairing'); };

  // ---- Settings ----
  const DL = [['Never', 'Never', "Devices can't download anything from this computer."], ['AllowAll', 'Allow all', 'Devices can download what you select in File Explorer, without asking.'], ['Ask', 'Ask every time', 'You approve each download in a small window.']];
  const NOTIFY = [['Once', 'Once per device', "A device's first connection of the day, with a sound."], ['Always', 'Always', 'Every connection. Only the first one of the day plays a sound.'], ['Never', 'Never', 'No notification when a device connects. A newly paired device is still announced.']];
  function settings() {
    const dl = DL.find((d) => d[0] === S.downloadPolicy) || DL[1];
    const nt = NOTIFY.find((d) => d[0] === S.notify) || NOTIFY[0];
    const adapters = S.adapters || [];
    const selA = adapters.find((a) => a.id === S.adapterId) || adapters[0] || { label: 'Automatic', meta: '' };
    const sec = (label, body, extra) => `<div class="group"${extra || ''}><span class="sec-label">${label}</span><div class="card rows">${body}</div></div>`;
    const row = (label, sub, ctl) => `<div class="row"><div class="row-text"><span class="row-label">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</div>${ctl}</div>`;
    return `<span class="h-page">Settings</span><div class="col-max">
      ${S.error ? `<div class="banner" style="align-items:center">${ic('alert')}<span style="flex:1">${esc(S.error)}</span><button class="icon-btn" data-act="dismissError" aria-label="Dismiss">${ic('x')}</button></div>` : ''}
      ${sec('General', row('Start with Windows', 'Waits in the tray, so a device can connect any time.', toggle(S.startup, 'set', 'Start with Windows', 'startup'))
        + `<div class="stack"><div class="row-text"><span class="row-label">Notify when a device connects</span><span class="row-sub">${nt[2]}</span></div>${seg(NOTIFY.map((n) => [n[0], n[1]]), nt[0], 'notify', 'Notify when a device connects')}</div>`)}
      ${sec('Updates', updatesSection())}
      ${sec('Files', `<div class="stack"><span class="row-label">Received files folder</span><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="path"><span>${esc(S.folder)}</span></span>
          <button class="btn secondary" style="height:34px" data-act="changeFolder">Change</button><button class="btn secondary" style="height:34px" data-act="openFolder" data-arg="received">Open folder</button></div>
          <span class="row-sub">A received file is also pasted into the app that's in front.</span></div>`
        + row('Save into the folder that is open in File Explorer', 'When a File Explorer window is in front, a sent file lands in that folder instead of the received-files folder. The device shows where the file will go and can choose the received-files folder for a send.', toggle(S.saveToOpenFolder, 'set', 'Save into the open File Explorer folder', 'saveToOpenFolder'))
        + row('Ask before saving received files', 'A small window asks you to Save or Decline.', toggle(S.askSave, 'set', 'Ask before saving received files', 'askSave'))
        + `<div class="stack"><span class="row-label">Allow downloading files from this computer</span>${seg(DL.map((d) => [d[0], d[1]]), dl[0], 'dlPolicy', 'Allow downloading files')}<span class="row-sub">${dl[2]} Select files or folders in File Explorer, then tap Download on the device.</span></div>`)}
      ${sec('Microphone', micSection())}
      ${sec('Network', `<div class="stack"><div class="row-text"><span class="row-label">Network adapter</span><span class="row-sub">The address in the QR code comes from this adapter. Change it only if devices can't reach the computer.</span></div>
          <button class="picker" data-act="toggleAddr" aria-expanded="${!!L.addrOpen}"><span style="flex:1">${esc(selA.label)}</span><span class="meta">${esc(selA.meta)}</span><span class="tone-sub" style="display:flex">${ic(L.addrOpen ? 'chevU' : 'chevD')}</span></button>
          ${L.addrOpen ? `<div class="menu" role="radiogroup">${adapters.map((a) => `<button role="radio" aria-checked="${a === selA}" data-act="pickAddr" data-arg="${esc(a.id || '')}"><span class="check">${a === selA ? ic('check') : ''}</span><span style="flex:1">${esc(a.label)}</span><span class="meta">${esc(a.meta)}</span></button>`).join('')}</div>` : ''}</div>`
        + row('Allow devices on networks Windows marks as Public', 'Only turn this on for networks you trust. Marking your home network as Private is usually the better fix.', toggle(S.publicAllowed, 'set', 'Allow devices on Public networks', 'publicAllowed'))
        + `<button class="row" data-act="netSettings"><span class="row-label" style="flex:1">Open Windows network settings</span><span class="tone-sub" style="display:flex">${ic('ext')}</span></button>`)}
      ${sec('Administrator access', `<div class="row"><div class="row-text"><span class="row-label">Admin windows</span>${S.helperRunning ? ''
          : `<span class="row-sub">Your phone or tablet can't control windows that run as administrator. Reinstalling the app fixes this.</span>`}</div>
          <span class="pill ${S.helperRunning ? 'tone-green' : 'tone-amber'}"><span class="dot"></span>${S.helperRunning ? 'Can be controlled' : 'Not available'}</span></div>`
        + row('Let the device answer Windows permission prompts', 'The dimmed screen that asks "Do you want to allow this app to make changes?". On: the device can approve anything that asks for administrator rights, like you at the keyboard, and so could any program running under your Windows account. Never the lock screen. Changing this asks for administrator permission.', toggle(S.uacPrompts, 'set', 'Let the device answer Windows permission prompts', 'uacPrompts', !S.helperRunning)))}
      ${sec('Data and logs', `<div class="row"><div class="row-text"><span class="row-label">Logs</span><span class="row-sub">What the app did and any errors, kept 3 days (5 MB at most). Never what you type, file names, window titles or addresses in full.${S.logSize ? ` Now ${esc(S.logSize)}.` : ''}</span></div>
          <div style="display:flex;gap:8px"><button class="btn secondary" style="height:34px" data-act="openFolder" data-arg="logs">${ic('folderOpen')}Open</button>${L.delLogs ? `<button class="btn primary" style="height:34px" data-act="deleteLogs">Delete all</button><button class="btn ghost" style="height:34px" data-act="cancelDelLogs">Cancel</button>` : `<button class="btn secondary" style="height:34px" data-act="askDelLogs">Delete</button>`}</div></div>`
        + row('Troubleshooting mode', S.troubleshooting ? `Detailed logs are on until ${esc(S.troubleshootUntil || '')}, then it turns itself off. Same rules: no typed text, names or addresses.` : 'Turn on when asked to, before reproducing a problem: detailed logs for 24 hours, then it turns itself off.', toggle(S.troubleshooting, 'set', 'Troubleshooting mode', 'troubleshooting')), ' style="padding-bottom:8px"')}
    </div>`;
  }
  A.set = (key, el) => { const value = el.getAttribute('aria-checked') !== 'true'; S[key] = value; render(); call('set', { key, value }); };
  A.notify = (v) => { S.notify = v; render(); call('set', { key: 'notify', value: v }); };
  A.dlPolicy = (v) => { S.downloadPolicy = v; render(); call('set', { key: 'downloadPolicy', value: v }); };
  A.toggleAddr = () => { L.addrOpen = !L.addrOpen; render(); };
  A.pickAddr = (id) => { L.addrOpen = false; S.adapterId = id || null; render(); call('set', { key: 'adapter', value: id || null }); };
  A.changeFolder = () => call('changeFolder');
  A.checkMic = async () => { L.micChecking = true; render(); await call('checkMic'); L.micChecking = false; render(); };
  A.dismissError = () => { S.error = ''; render(); };
  A.askDelLogs = () => { L.delLogs = true; render(); };
  A.cancelDelLogs = () => { L.delLogs = false; render(); };
  A.deleteLogs = () => { L.delLogs = false; render(); call('deleteLogs'); };
  A.fbPreview = () => call('feedbackPreview');

  // Microphone: any virtual audio cable works; known ones are found automatically, others can be chosen.
  function micSection() {
    const c = S.micChosen;
    const targets = S.micTargets || [];
    const status = `<div class="row"><div class="row-text"><span class="row-label">Virtual audio cable</span><span class="row-sub">${c
        ? (c.cable ? `The device's microphone plays into ${esc(c.cable)}. In your call or recording app, choose <span class="strong">${esc(c.recording)}</span> as the microphone.`
          : `The device's microphone plays into ${esc(c.name)}, which isn't a known virtual cable. If that's your speakers or headphones, you'll hear yourself.`)
        : 'Needed to use a phone or tablet as a microphone.'}</span></div>
      <span class="pill ${c ? (c.cable ? 'tone-green' : 'tone-amber') : 'tone-amber'}"><span class="dot"></span>${c ? (c.cable ? 'Installed' : 'Check device') : 'Missing'}</span></div>`;
    const install = c ? '' : `<div class="stack"><span class="sub2 small" style="line-height:1.5">A virtual audio cable passes the voice from your phone or tablet to your apps as a microphone. VB-CABLE is free and the simplest; VoiceMeeter and Virtual Audio Cable work too. They're made by other companies, and ${esc(APP)} doesn't install them for you. After installing, restart the computer.</span>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="openUrl" data-arg="https://vb-audio.com/Cable/">Download VB-CABLE${ic('ext')}</button><button class="btn secondary" data-act="checkMic">${L.micChecking ? 'Checking…' : 'Check again'}</button><span class="mono tone-sub" style="font-size:11.5px">vb-audio.com/Cable</span></div></div>`;
    if (!targets.length) return status + install;
    const auto = { id: null, label: 'Automatic', meta: S.micAuto || 'no virtual cable found' };
    const opts = [auto].concat(targets.map((t) => ({ id: t.id, label: t.name, meta: t.cable ? 'virtual cable' : 'speakers / other' })));
    const sel = opts.find((o) => o.id === (S.micDevice || null)) || auto;
    const picker = `<div class="stack"><div class="row-text"><span class="row-label">Send the device's microphone to</span><span class="row-sub">Automatic uses the first virtual cable it finds. Choose another only if you use a different cable.</span></div>
      <button class="picker" data-act="toggleMic" aria-expanded="${!!L.micOpen}"><span class="ellipsis" style="flex:1">${esc(sel.label)}</span><span class="meta">${esc(sel.meta)}</span><span class="tone-sub" style="display:flex">${ic(L.micOpen ? 'chevU' : 'chevD')}</span></button>
      ${L.micOpen ? `<div class="menu" role="radiogroup">${opts.map((o) => `<button role="radio" aria-checked="${o === sel}" data-act="pickMic" data-arg="${esc(o.id || '')}"><span class="check">${o === sel ? ic('check') : ''}</span><span class="ellipsis" style="flex:1">${esc(o.label)}</span><span class="meta">${esc(o.meta)}</span></button>`).join('')}</div>` : ''}</div>`;
    return status + install + picker;
  }
  // Updates (docs/auto-update.md): signed, checked by the app and again by the helper service, installed silently.
  const UPD = [['Automatic', 'Automatic', 'Installs when no device has been connected for 10 minutes. The app restarts on its own.'], ['NotifyOnly', 'Notify me', 'Tells you when an update is ready. You choose when to install.'], ['Off', 'Off', "Doesn't check. You can still check by hand here."]];
  function updatesSection() {
    const ver = `<div class="row"><div class="row-text"><span class="row-label">Version ${esc(S.semVersion || S.version || '')}</span><span class="row-sub">${S.updatesEnabled
        ? esc(S.lastCheckResult || 'Not checked yet.') + (S.lastCheck ? ` Last checked ${esc(S.lastCheck)}.` : '')
        : "This version doesn't check for updates. New versions are on the releases page."}</span></div>
      ${S.updatesEnabled ? `<button class="btn secondary" style="height:34px" data-act="updCheck"${L.updChecking ? ' disabled' : ''}>${ic('refresh')}${L.updChecking ? 'Checking…' : 'Check now'}</button>`
        : `<button class="btn secondary" style="height:34px" data-act="openUrl" data-arg="${esc(S.releasesUrl || '')}">Releases${ic('ext')}</button>`}</div>`;
    if (!S.updatesEnabled) return ver;
    const u = S.update;
    const avail = u ? `<div class="stack"><div class="row-text"><span class="row-label">${u.critical ? 'Security update ' : 'Version '}${esc(u.version)} ${u.ready ? 'is ready to install' : u.downloading ? 'is downloading…' : 'is available'}</span>
        ${u.notes ? `<span class="row-sub" style="white-space:pre-line">${esc(u.notes)}</span>` : ''}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button class="btn primary" style="height:34px" data-act="updInstall"${L.updInstalling ? ' disabled' : ''}>${ic('download')}${L.updInstalling ? 'Installing…' : 'Install now'}</button>
        ${u.critical ? '' : '<button class="btn secondary" style="height:34px" data-act="updSkip">Skip this version</button>'}
        ${u.notesUrl ? `<button class="btn link" data-act="openUrl" data-arg="${esc(u.notesUrl)}">What's new${ic('ext')}</button>` : ''}</div>
      <span class="row-sub">Connected devices disconnect for about a minute while the app restarts.</span></div>` : '';
    const warn = S.updateCrash ? `<div class="note" style="background:var(--amber-bg)">${ic('alert')}<span>The last update may not have installed correctly: the app stopped early twice in a row since then. Automatic installs are paused until a start completes. If it keeps happening, reinstall from the <button class="btn link" style="height:auto;padding:0;font-size:inherit;color:var(--txt)" data-act="openUrl" data-arg="${esc(S.releasesUrl || '')}">releases page</button>.</span></div>`
      : S.updateFailed ? `<div class="note" style="background:var(--amber-bg)">${ic('alert')}<span>The update to ${esc(S.updateFailed)} didn't finish, so this version is still installed. It's tried again on the next check.</span></div>`
      : S.updateStale ? `<div class="note" style="background:var(--amber-bg)">${ic('alert')}<span>The app couldn't get update information for over 30 days. Check your connection, or get the latest version from the releases page.</span></div>` : '';
    const m = UPD.find((x) => x[0] === S.updateMode) || UPD[0];
    return ver + avail + (warn ? `<div class="stack">${warn}</div>` : '')
      + `<div class="stack"><div class="row-text"><span class="row-label">Install updates</span><span class="row-sub">${m[2]}</span></div>${seg(UPD.map((x) => [x[0], x[1]]), m[0], 'updMode', 'Install updates')}</div>`
      + ((S.updateChannels || []).includes('stable') ? `<div class="stack"><div class="row-text"><span class="row-label">Update channel</span><span class="row-sub">${S.updateChannel === 'stable' ? 'Only finished releases.' : 'Test versions as well as finished releases: new things sooner, with a few more bugs.'}</span></div>${seg([['beta', 'Beta'], ['stable', 'Stable']], S.updateChannel || 'beta', 'updChannel', 'Update channel')}</div>` : '');
  }
  A.updCheck = async () => { L.updChecking = true; render(); await call('updateCheck'); L.updChecking = false; render(); };
  A.updInstall = async () => {
    L.updInstalling = true; S.error = ''; render();
    const r = await call('updateInstall');
    L.updInstalling = false;
    if (!r.ok && r.error) S.error = r.error;
    render();
  };
  A.updSkip = () => call('updateSkip');
  A.updLater = () => { L.updLater = (S.update || {}).version; render(); };
  A.updMode = (v) => { S.updateMode = v; render(); call('set', { key: 'updateMode', value: v }); };
  A.updChannel = (v) => { S.updateChannel = v; render(); call('set', { key: 'updateChannel', value: v }); };
  function updateBanner() {
    const u = S.update;
    if (!u || !u.ready || L.updLater === u.version) return '';
    return `<div class="banner${u.critical ? '' : ' info'}" style="align-items:center;margin-bottom:4px">${ic(u.critical ? 'shieldAlert' : 'download')}<span style="flex:1"><span class="strong">${u.critical ? 'Security update' : 'Update'} ${esc(u.version)} is ready.</span> Devices disconnect for about a minute while it installs.</span>
      <button class="btn primary" data-act="updInstall"${L.updInstalling ? ' disabled' : ''}>${L.updInstalling ? 'Installing…' : 'Install now'}</button>${u.critical ? '' : '<button class="btn ghost" data-act="updLater">Later</button>'}</div>`;
  }
  A.toggleMic = () => { L.micOpen = !L.micOpen; render(); };
  A.pickMic = (id) => { L.micOpen = false; S.micDevice = id || null; render(); call('set', { key: 'micDevice', value: id || null }); };

  // ---- Help ----
  function helpContent() {
    const pc = S.pcName || 'this computer';
    return [
      { t: 'Getting connected', items: [
        { id: 'connect', q: 'How do I connect my phone or tablet?', go: 'connect', a: [`Open ${APP} on the computer. The Connect page shows a QR code. You can also click the tray icon next to the clock.`, "Scan the code with the camera of your phone or tablet. The remote opens in its browser, so there's nothing to install.", 'The device and the computer need to be on the same Wi-Fi. The first time, click Allow on the computer.'] },
        { id: 'again', q: 'Do I need to scan every time?', a: ['No. A paired device reconnects on its own, also after the computer restarts. Add the remote to the home screen to open it like an app.', "If the computer's network address changes (another Wi-Fi, a new router), scan the code again."] },
        { id: 'cant', q: "My phone or tablet can't connect", a: ["Check that the device and the computer are on the same Wi-Fi. Mobile data won't work.", 'Guest networks often keep devices apart. Connect the device to your main Wi-Fi.', 'If the computer has Wi-Fi and a cable, or a VPN, the code may use the wrong address. Pick the right one in Settings › Network › Network adapter.', 'After 10 different wrong codes, the computer ignores that device for 15 minutes. Scan the current code.'] },
        { id: 'public', q: 'The network is marked Public', go: 'connect', a: ['Windows blocks devices on networks it marks as Public. On the Connect page choose Mark as Private, or turn on Allow devices on networks Windows marks as Public in Settings › Network.'] }] },
      { t: 'Certificate warning', items: [
        { id: 'why', q: 'Why does the browser warn about the certificate?', a: ['The connection is encrypted with a certificate made by your own computer, not by a company the browser already knows. That is why it warns.', 'The connection stays on your home network. Install the certificate once on each phone or tablet and the warning goes away.'] },
        { id: 'install', q: 'How do I install the certificate on an iPhone?', go: 'certificate', a: ['1. Open Certificate in the app. Scan the code with the iPhone camera and tap Allow.', `2. Open Settings › General › VPN & Device Management. Tap the “${APP} - ${pc}” profile, then Install.`, `3. Open Settings › General › About › Certificate Trust Settings and turn on full trust for “${APP} Local Authority (${pc})”.`, "You only do this once per device. It keeps working when the computer's address changes."] },
        { id: 'installAndroid', q: 'How do I install the certificate on an Android phone?', go: 'certificate', a: ['1. Open Certificate in the app, choose Android and scan the code. If the browser warns, tap Advanced › Proceed; the certificate file downloads.', '2. Open Settings › Security & privacy › More security settings › Encryption & credentials › Install a certificate › CA certificate (Samsung: Security and privacy › Other security settings › Install from device storage).', `3. Confirm, then pick the downloaded “${APP.toLowerCase()}-ca.crt”.`, 'Works in Chrome and Samsung Internet. Firefox on Android ignores certificates you add yourself, so there you continue past the warning.'] }] },
      { t: 'Home screen icon', items: [
        { id: 'home', q: 'How do I add the remote to the home screen?', a: ['iPhone and iPad: in Safari, tap Share › Add to Home Screen.', 'Android: in Chrome, tap ⋮ › Add to Home screen.'] },
        { id: 'homeCert', q: 'The home-screen icon stopped working', go: 'certificate', a: ['A home-screen app can only connect while the device trusts the certificate: unlike the browser, it has no “continue anyway” button. If the certificate was removed or its trust turned off, the icon opens a blank page.', 'Install the certificate again from the Certificate page, or open the remote in the browser instead: scan the code, continue past the warning, and use it there.', 'The same happens when the computer gets a new network address: install the new certificate, then the icon works again.'] }] },
      { t: 'Sending and downloading files', items: [
        { id: 'send', q: 'How do I send a file to the computer?', a: ["Tap Send file in the remote. The file is saved to the received files folder (Settings › Files) and pasted into the app that's in front on the computer.", 'Settings can ask you before each file is saved.'] },
        { id: 'down', q: 'Can a phone or tablet download files from this computer?', a: ['If Settings › Files allows it. Select files or folders in File Explorer on the computer, then tap Download on the device.', 'Choose Ask every time to approve each download. Several files or a folder are sent as one zip.'] }] },
      { t: 'Device as microphone', items: [
        { id: 'mic', q: 'How do I use my phone or tablet as a microphone?', link: { label: 'Download VB-CABLE', href: 'https://vb-audio.com/Cable/' }, a: ['Its microphone needs a virtual audio cable on the computer. VB-CABLE is free and the simplest; VoiceMeeter and Virtual Audio Cable work too. Install one once, then restart the computer.', 'Tap the microphone button in the remote. In your call or recording app, choose the cable\'s recording side as the microphone: CABLE Output for VB-CABLE, VoiceMeeter Output for VoiceMeeter. Settings › Microphone shows the exact name.'] }] },
      { t: 'Start with Windows', items: [
        { id: 'admin', q: 'Can my phone or tablet control admin windows and permission prompts?', a: [`${APP} runs with normal rights. A small helper service that comes with it lets the device control windows that run as administrator, like installers and Task Manager.`, "Windows' permission prompts (the dimmed screen that asks Yes or No) can be answered from the device only if you turn that on in Settings › Administrator access. It's off at first, and turning it on asks for administrator permission. While it's on, any program running under your Windows account could approve prompts the same way, so leave it off unless you need it.", 'The lock screen, the sign-in screen, and typing your Windows password or PIN are never possible from the device.'] },
        { id: 'close', q: 'I closed the window. Is the app still running?', a: ['Yes. Closing the window hides it to the tray next to the clock. To quit, right-click the tray icon and choose Exit.'] }] },
      { t: 'Pairing and devices', items: [
        { id: 'newcode', q: 'What does New code do?', a: ['It makes a new QR code for pairing new devices; the old one stops working. Devices that are already paired keep working.', 'The code also changes by itself each time a device pairs and when you ban one, so a photo of an old code or an old link can\'t pair anything.'] },
        { id: 'ban', q: 'How do I remove or block a device?', go: 'devices', a: ['Open Devices. Remove forgets a device: it can pair again by scanning the code. Ban stops it from connecting and changes the code, so it can\'t pair again from another browser either.', 'Reset pairing forgets every device at once.'] },
        { id: 'perm', q: 'Do permissions lock a device out?', a: ['No. They are limits, not a lock. A connected device controls the mouse and keyboard, so it can reach anything on the screen. Only pair devices you trust, and keep Approve new devices on (Devices).'] }] },
      { t: 'Security and privacy', items: [
        { id: 'power', q: 'What can a paired device do?', go: 'devices', a: ["Anything you can do at the keyboard and mouse: open files, send messages, delete things. Only pair devices you own, and keep Approve new devices on.", "If a paired device is lost, remove it in Devices. Anyone holding it unlocked could control this computer while the app runs.", "Windows that run as administrator can be controlled too. Windows' permission prompts only if you turn that on in Settings › Administrator access. The sign-in screen and your Windows password or PIN never can."] },
        { id: 'sent', q: 'What does the computer send to the device?', a: ['Only to paired devices, encrypted, on your own network:', "The text around the cursor in the field you're typing in (never password fields), so the device's text field can follow it.", 'The names of open windows (for the app switcher) and of the app in front, and what is playing.', 'The clipboard and files, only when you ask for them on the device.'] },
        { id: 'qr', q: 'Is the QR code secret?', a: ['Yes, treat it like a key. Anyone who sees it, for example in a screen share, a stream or a photo, can ask to pair. A new device still needs your Allow on this computer, and the code changes after each pairing.', "Don't show it while sharing your screen. Make a new code on the Connect page if you think someone saw it."] },
        { id: 'wifi', q: 'Can I use it on public Wi-Fi?', go: 'connect', a: ["It's made for your home network. On public networks (café, hotel, airport) Windows blocks devices, and that's the safe setting.", 'Anyone on the same Wi-Fi can open the page, but not control the computer without pairing. After 10 wrong codes an address is ignored for 15 minutes.', 'Work computer? Check with IT first: remote-control tools may not be allowed.'] },
        { id: 'certscope', q: 'What does the certificate let my phone or tablet trust?', go: 'certificate', a: [`Only this computer on your home network. It's limited to local addresses, so it can't be used to fake any website.`, `Uninstalling ${APP} doesn't remove it from the device. Delete it on an iPhone in Settings › General › VPN & Device Management; on Android in Settings › Security & privacy › More security settings › Encryption & credentials › User credentials.`] },
        { id: 'priv', q: 'Does anything leave my home network?', link: { label: 'Privacy policy', href: 'https://tontturemote.app/privacy' }, a: ["The remote itself never: the device and the computer talk directly on your local network. There's no account and no cloud.", 'Update checks fetch a small file from the website; downloads come from GitHub. Only the app version is sent, plus the IP address any website sees.', 'Feedback only leaves when you send the email yourself.'] }] },
    ];
  }
  function help() {
    const secs = helpContent();
    if (L.art) {
      const sec = secs.find((s) => s.items.some((i) => i.id === L.art));
      const it = sec && sec.items.find((i) => i.id === L.art);
      if (it) {
        const goLabel = { connect: 'Go to Connect', certificate: 'Open Certificate', devices: 'Open Devices' }[it.go];
        return `<div class="article"><button class="btn ghost" style="align-self:flex-start;font-size:13px;font-weight:500;padding:0 10px 0 6px" data-act="closeArt">${ic('arrowL')}All help</button>
          <div style="display:flex;flex-direction:column;gap:8px"><span class="sec-label" style="padding:0">${esc(sec.t)}</span><span class="h-page" style="line-height:1.3;text-wrap:balance">${esc(it.q)}</span></div>
          <div style="display:flex;flex-direction:column;gap:12px">${it.a.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
          ${it.link ? (web ? `<a class="btn primary" style="align-self:flex-start;height:34px;text-decoration:none" href="${it.link.href}" target="_blank" rel="noopener">${esc(it.link.label)}${ic('ext')}</a>` : `<button class="btn primary" style="align-self:flex-start;height:34px" data-act="openUrl" data-arg="${it.link.href}">${esc(it.link.label)}${ic('ext')}</button>`) : ''}
          ${goLabel && !web ? `<button class="btn secondary" style="align-self:flex-start;height:34px" data-act="go" data-arg="${it.go}">${goLabel}${ic('arrowR')}</button>` : ''}
          ${web ? '' : `<div style="height:1px;background:var(--line);margin-top:8px"></div><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="sub">Didn't help?</span><button class="btn link" style="color:var(--txt);font-size:13px" data-act="go" data-arg="feedback">Send feedback</button></div>`}</div>`;
      }
    }
    const q = L.q.trim().toLowerCase();
    const shown = secs.map((s) => ({ t: s.t, items: s.items.filter((it) => !q || (it.q + ' ' + it.a.join(' ')).toLowerCase().includes(q)) })).filter((s) => s.items.length);
    return `<div class="help-col" style="gap:14px"><span class="h-page">Help</span>
        <label class="search">${ic('search')}<input data-k="q" data-input="setQ" value="${esc(L.q)}" placeholder="Search help" aria-label="Search help" autocomplete="off" spellcheck="false">${L.q ? `<button class="icon-btn" data-act="clearQ" aria-label="Clear search">${ic('x')}</button>` : ''}</label></div>
      <div class="help-col">${shown.map((s) => `<div class="group"><span class="sec-label">${esc(s.t)}</span><div class="help-card">${s.items.map((it) => `<button class="qa" data-act="article" data-arg="${it.id}"><span style="flex:1;text-wrap:pretty">${esc(it.q)}</span>${ic('chevR')}</button>`).join('')}</div></div>`).join('')}
        ${shown.length ? '' : `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:40px 24px"><span class="tone-sub">${ic('searchOff')}</span><span style="font:600 15px var(--sans)">No answers for “${esc(L.q)}”</span><span class="sub" style="max-width:300px">Try another word, like Wi-Fi, certificate or microphone.</span></div>`}
        ${web ? (S.feedbackEmail ? `<a class="link-row" style="margin-bottom:8px;text-decoration:none;color:inherit" href="mailto:${esc(S.feedbackEmail)}?subject=${encodeURIComponent(APP + ' feedback')}"><span class="tile">${ic('mail')}</span><span class="row-text" style="gap:2px"><span style="font:600 13px var(--sans)">Send feedback by email</span><span class="sub small">${esc(S.feedbackEmail)}</span></span><span class="tone-sub" style="display:flex">${ic('ext')}</span></a>` : '') : `<button class="link-row" style="margin-bottom:8px" data-act="go" data-arg="feedback"><span class="tile">${ic('chat')}</span><span class="row-text" style="gap:2px"><span style="font:600 13px var(--sans)">Send feedback or request a feature</span><span class="sub small">Report a problem or suggest something new.</span></span><span class="tone-sub" style="display:flex">${ic('chevR')}</span></button>`}</div>`;
  }
  A.setQ = (v) => { L.q = v; render(); };
  A.clearQ = () => { L.q = ''; render(); const i = app.querySelector('[data-k="q"]'); if (i) i.focus(); };
  A.closeArt = () => { L.art = null; L.scrollTop = true; render(); };

  // ---- Feedback (stopgap: the user's email app sends it) ----
  function feedback() {
    const back = `<button class="btn ghost" style="align-self:flex-start;font-size:13px;font-weight:500;padding:0 10px 0 6px" data-act="go" data-arg="help">${ic('arrowL')}Help</button>`;
    const r = L.fres;
    const fileChip = (f) => `<span class="path" style="flex:none;min-width:0;max-width:100%;gap:8px">${ic('doc')}<span>${esc(f.split('\\').slice(-2).join('\\'))}</span></span>`;
    const done = `<button class="btn secondary md" data-act="go" data-arg="help">Done</button>`;
    if (r && r.sent) {
      return `<div class="article" style="max-width:560px">${back}<div style="display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:28px 0">
        <span class="result-ic">${ic('check')}</span><div style="display:flex;flex-direction:column;gap:6px"><span style="font:600 20px var(--sans)">Sent. Thank you.</span>
        <span class="sub" style="line-height:1.55">${r.attached ? 'Your message and the attachments are on their way.' : 'Your message is on its way.'}${r.testimonial ? ` Thanks for the review: it may appear on the website as ${esc(r.testimonial)}.` : L.email.trim() ? ` A reply, if any, goes to ${esc(L.email.trim())}.` : ' You left no email address, so there will be no reply.'}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${done}</div></div></div>`;
    }
    if (r && r.failed) {
      return `<div class="article" style="max-width:560px">${back}<div style="display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:28px 0">
        <span class="result-ic amber">${ic('alert')}</span><div style="display:flex;flex-direction:column;gap:6px"><span style="font:600 20px var(--sans)">Not sent</span>
        <span class="sub" style="line-height:1.55">${esc(r.error || 'Something went wrong.')} Your message is kept below.</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary md" data-act="fbAgain">Try again</button>${S.feedbackEmail ? `<button class="btn secondary md" data-act="sendFbMail">${ic('mail')}Open in email instead</button>` : ''}</div></div></div>`;
    }
    if (r && r.opened) {
      return `<div class="article" style="max-width:560px">${back}<div style="display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:28px 0">
        <span class="result-ic">${ic('mail')}</span><div style="display:flex;flex-direction:column;gap:6px"><span style="font:600 20px var(--sans)">Finish in your email app</span>
        <span class="sub" style="line-height:1.55">Your email app opened with the message. Check it and press Send there.${r.email ? '' : ' Add the recipient yourself: this version has no feedback address yet.'}</span></div>
        ${r.file ? `<span class="sub small">Attach this file from the Desktop:</span>${fileChip(r.file)}` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">${r.file ? `<button class="btn secondary md" data-act="showFile" data-arg="${esc(r.file)}">Show in folder</button>` : ''}${done}</div></div></div>`;
    }
    if (r && r.mail && !r.opened) {
      return `<div class="article" style="max-width:560px">${back}<div style="display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:28px 0">
        <span class="result-ic amber">${ic('mail')}</span><div style="display:flex;flex-direction:column;gap:6px"><span style="font:600 20px var(--sans)">No email app found</span>
        <span class="sub" style="line-height:1.55">This computer has no email app set up for sending. ${r.file ? 'Your message was saved to the Desktop, so nothing is lost.' : ''}</span></div>
        ${r.file ? fileChip(r.file) : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">${r.file ? `<button class="btn secondary md" data-act="showFile" data-arg="${esc(r.file)}">Show in folder</button>` : ''}<button class="btn secondary md" data-act="fbAgain">Back to the message</button></div></div></div>`;
    }
    const ph = { problem: 'What happened, and what did you expect?', feature: 'What would you like the app to do, and when would you use it?', other: `What do you like, and what would make ${APP} better?`, security: 'What did you find, and how can it be reproduced?' }[L.ftype];
    const online = !!S.contactApi;
    return `<div class="article" style="max-width:560px">${back}<div class="row-text" style="gap:4px"><span class="h-page">Send feedback</span><span class="sub">${online ? 'Report a problem, suggest something or ask a question. It goes straight to the developer.' : "Report a problem or suggest something. It opens in your email app, so you see exactly what's sent."}</span></div>
      ${seg([['problem', 'Bug'], ['feature', 'Idea'], ['other', 'Feedback'], ['security', 'Security']], L.ftype, 'ftype', 'Feedback type')}
      ${online && L.ftype === 'other' ? `<div class="card pad" style="display:flex;flex-direction:column;gap:10px;padding:12px 14px">
        <span style="font:500 13px var(--sans)">How would you rate ${APP}?</span>
        <div style="display:flex;align-items:center;gap:2px" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button class="star${n <= L.rating ? ' on' : ''}" role="radio" aria-checked="${n === L.rating}" aria-label="${n} star${n > 1 ? 's' : ''}" data-act="setRating" data-arg="${n}">★</button>`).join('')}<span class="sub small" style="margin-left:10px">${['Tap a star', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][L.rating]}</span></div>
        <button role="checkbox" aria-checked="${L.allowPublish}" data-act="toggleAllow" style="display:flex;align-items:center;gap:10px;padding:0;border:0;background:transparent;font:500 13px var(--sans);text-align:left"><span class="check-box">${L.allowPublish ? ic('check') : ''}</span>You may publish my feedback on the website as a testimonial.</button>
        ${L.allowPublish ? `<label class="field" style="padding-left:28px"><span style="font:500 13px var(--sans)">Name to show <span class="sub small" style="font-weight:400">(optional)</span></span><input type="text" maxlength="60" data-k="pubName" data-input="setPubName" value="${esc(L.pubName)}" placeholder="e.g. Mika, Helsinki" spellcheck="false"><span class="sub small">Leave empty to appear as “${APP} user”. Your email is never published.</span></label>` : ''}</div>` : ''}
      ${L.ftype === 'security' ? `<div class="note">${ic('info')}<span>Security reports are private. Leave your email so the developer can follow up, and don't share the issue publicly until it's fixed.</span></div>` : ''}
      <label class="field"><span style="font:500 13px var(--sans)">Message</span><textarea rows="6" maxlength="5000" data-k="msg" data-input="setMsg" placeholder="${ph}">${esc(L.msg)}</textarea></label>
      ${online ? `<label class="field"><span style="font:500 13px var(--sans)">Your email <span class="sub small" style="font-weight:400">(optional, only for a reply)</span></span><input type="email" maxlength="200" data-k="email" data-input="setEmail" value="${esc(L.email)}" placeholder="you@example.com" autocomplete="email" spellcheck="false"></label>` : ''}
      ${online ? `<div class="card pad" style="display:flex;align-items:center;gap:10px;padding:10px 14px">${L.file ? `<span class="path" style="flex:1;min-width:0;gap:8px">${ic('doc')}<span style="overflow:hidden;text-overflow:ellipsis">${esc(L.file.name)}</span><span class="sub small" style="flex:none">${fmtSize(L.file.size)}</span></span><button class="btn ghost" style="height:28px;font-size:12px" data-act="fbClearFile">Remove</button>` : `<button class="btn secondary" style="height:30px;font-size:12px" data-act="fbPickFile">${ic('doc')}Attach a file</button><span class="sub small">A screenshot, a recording, anything up to 10 MB.</span>`}</div>` : ''}
      ${L.ftype === 'problem' || L.ftype === 'security' ? `<div class="card pad" style="display:flex;flex-direction:column;gap:8px;padding:12px 14px"><div style="display:flex;align-items:center;gap:10px">
        <button role="checkbox" aria-checked="${L.diag}" data-act="toggleDiag" style="display:flex;align-items:center;gap:10px;padding:0;border:0;background:transparent;font:500 13px var(--sans)"><span class="check-box">${L.diag ? ic('check') : ''}</span>Attach diagnostics</button>
        <div style="flex:1"></div><button class="btn ghost" style="height:26px;font-size:12px;font-weight:500" data-act="toggleIncl">What's included${ic(L.incl ? 'chevU' : 'chevD')}</button></div>
        ${L.incl ? `<div style="display:flex;flex-direction:column;gap:8px;padding-left:28px"><span class="sub small" style="line-height:1.55">Your message, the app and Windows versions, and the app's logs from the last 3 days${online ? ', as a zip file attached to the message' : ', saved as a zip on the Desktop for you to attach'}. Addresses, your Windows user name, email addresses and anything key-like are blanked out first. Never pairing codes, keys or what you type.</span><button class="btn secondary" style="height:30px;font-size:12px;align-self:flex-start" data-act="fbPreview">Show the exact text</button></div>` : ''}</div>` : ''}
      ${online || S.feedbackEmail ? '' : '<div class="note">' + ic('info') + '<span>This version has no feedback address yet. The email opens without a recipient.</span></div>'}
      ${online ? `<span class="sub small">Sent over the internet to the developer's mailbox; the <button class="btn link" style="height:auto;padding:0;font-size:12px" data-act="openUrl" data-arg="${esc((S.website || '') + '/privacy')}">privacy policy</button> says what is kept.</span>` : ''}
      <div class="actions" style="padding-bottom:8px"><button class="btn secondary md" data-act="go" data-arg="help">Cancel</button>${online && S.feedbackEmail ? `<button class="btn secondary md" data-act="sendFbMail"${L.msg.trim() && !L.sending ? '' : ' disabled'}>${ic('mail')}Open in email</button>` : ''}<button class="btn primary md" data-act="${online ? 'sendFb' : 'sendFbMail'}"${L.msg.trim() && !L.sending ? '' : ' disabled'}>${ic(online ? 'send' : 'mail')}${L.sending ? (online ? 'Sending…' : 'Opening…') : (online ? 'Send' : 'Open in email')}</button></div></div>`;
  }
  const FB_KIND = { problem: 'Bug', feature: 'Idea', other: 'Feedback', security: 'Security' };
  const FB_MAIL_KIND = { problem: 'Problem', feature: 'Feature request', other: 'Other', security: 'Security' };
  A.ftype = (v) => { L.ftype = v; L.diag = false; render(); }; // diagnostics offered for Bug and Security, always unticked by default (user's choice each time)
  A.setMsg = (v) => { const had = !!L.msg.trim(); L.msg = v; if (had !== !!v.trim()) render(); };
  A.setEmail = (v) => { L.email = v; };
  A.setRating = (n) => { L.rating = +n; render(); };
  A.toggleAllow = () => { L.allowPublish = !L.allowPublish; render(); };
  A.setPubName = (v) => { L.pubName = v; };
  A.fbPickFile = async () => { const r = await call('feedbackPickFile'); if (r.ok && S.feedbackFile) L.file = S.feedbackFile; else if (r.error) L.fres = { failed: true, error: r.error, keep: true }; render(); };
  A.fbClearFile = () => { L.file = null; render(); };
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  A.toggleDiag = () => { L.diag = !L.diag; render(); };
  A.toggleIncl = () => { L.incl = !L.incl; render(); };
  A.sendFb = async () => {
    L.sending = true; render();
    const fb = L.ftype === 'other';
    const res = await call('feedbackSend', { kind: FB_KIND[L.ftype], message: L.msg, email: L.email.trim(), diag: L.diag && (L.ftype === 'problem' || L.ftype === 'security'), file: L.file ? L.file.path : '', rating: fb ? L.rating : 0, allowPublish: fb && L.allowPublish, publicName: fb && L.allowPublish ? L.pubName.trim() : '' });
    L.sending = false;
    const sent = S.feedbackSent || {};
    L.fres = res.ok && sent.sent ? { sent: true, attached: !!sent.attached, testimonial: fb && L.allowPublish ? (L.pubName.trim() || `${APP} user`) : '' } : { failed: true, error: sent.error || res.error || '' };
    if (L.fres.sent) { L.msg = ''; L.file = null; L.rating = 0; L.allowPublish = false; L.pubName = ''; }
    render();
  };
  A.sendFbMail = async () => {
    L.sending = true; render();
    await call('feedback', { kind: FB_MAIL_KIND[L.ftype], message: L.msg, diag: L.diag });
    L.sending = false;
    L.fres = Object.assign({ mail: true }, S.feedbackResult || { opened: false });
    if (L.fres.opened) L.msg = '';
    render();
  };
  A.fbAgain = () => { L.fres = null; render(); };
  A.showFile = (path) => call('showFile', { path });

  // ---- About ----
  function about() {
    return `<div class="article" style="max-width:560px;gap:20px"><div style="display:flex;align-items:center;gap:16px">${appIcon(56)}
        <div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;gap:8px"><span class="h-page">${esc(APP)}</span><span class="tag" style="height:22px;font-size:11px">Beta</span></div><span class="sub">Control this computer from your phone or tablet.</span></div></div>
      <div class="card rows"><div class="row" style="padding:12px 0"><span class="sub2" style="flex:1;font-weight:500">Version</span><span class="mono small">${esc(S.semVersion || S.version)}</span></div>
        ${S.buildDate ? `<div class="row" style="padding:12px 0"><span class="sub2" style="flex:1;font-weight:500">Build date</span><span class="mono small">${esc(S.buildDate)}</span></div>` : ''}
        <div class="row" style="padding:10px 0;gap:12px"><span class="sub2" style="font-weight:500">Data folder</span><span class="mono small ellipsis" style="flex:1;text-align:right">${esc(S.dataFolder)}</span><button class="btn secondary" style="height:30px;font-size:12px" data-act="openFolder" data-arg="data">Open</button></div></div>
      <div class="help-card"><button class="list-btn" data-act="aboutCheck"${L.updChecking ? ' disabled' : ''}>${ic('refresh')}<span style="flex:1">${L.updChecking ? 'Checking for updates…' : 'Check for updates'}</span>${ic('chevR')}</button>
        ${L.aboutChecked && !L.updChecking ? `<div class="row" style="padding:10px 16px;gap:12px"><span class="sub small" style="flex:1">${esc(S.lastCheckResult || '')}</span>${S.update ? `<button class="btn primary" style="height:30px;font-size:12px" data-act="updInstall"${L.updInstalling ? ' disabled' : ''}>${L.updInstalling ? 'Installing…' : 'Install now'}</button>` : ''}</div>` : ''}
        ${S.website ? `<button class="list-btn" data-act="openUrl" data-arg="${esc(S.website)}/licence">${ic('doc')}<span style="flex:1">Licence agreement</span>${ic('ext')}</button>
        <button class="list-btn" data-act="openUrl" data-arg="${esc(S.website)}/privacy">${ic('shieldCheck')}<span style="flex:1">Privacy policy</span>${ic('ext')}</button>` : ''}
        <button class="list-btn" data-act="openFolder" data-arg="notices">${ic('doc')}<span style="flex:1">Third-party notices</span>${ic('chevR')}</button>
        <button class="list-btn" data-act="go" data-arg="feedback">${ic('chat')}<span style="flex:1">Send feedback or request a feature</span>${ic('chevR')}</button>
        ${S.supportUrl ? `<button class="list-btn" data-act="openUrl" data-arg="${esc(S.supportUrl)}">${ic('heart')}<span style="flex:1">Support the developer</span>${ic('ext')}</button>` : ''}</div>
      <span class="sub small">Free to use. No account, no ads.</span></div>`;
  }

  // Checks in place: the result shows under the row, on this page.
  A.aboutCheck = async () => { L.aboutChecked = true; await A.updCheck(); };

  // ---- Welcome (first run, inside the app window) ----
  function welcome() {
    const st = L.step;
    let h = `<div class="welcome-wrap"><div class="welcome"><div class="w-dots">${[1, 2, 3].map((i) => `<span class="d${i <= st ? ' on' : ''}${i === st ? ' cur' : ''}"></span>`).join('')}<span style="flex:1"></span><span class="mono tone-sub" style="font-size:11px">${st} / 3</span></div>`;
    if (st === 1) {
      h += `<div style="display:flex;flex-direction:column;gap:18px"><div style="display:flex;flex-direction:column;gap:8px"><span class="h-lg">Control this computer from your phone or tablet</span><span class="sub" style="font-size:14px;line-height:1.55">Scan one code. The remote opens in the device's browser, so there's nothing to install on it.</span></div>
        <div class="card rows" style="padding:4px 16px">${[['touch', 'Touchpad, keyboard and context buttons'], ['slides', 'Slides clicker, app switcher and power'], ['swap', 'Send files both ways'], ['mic', 'Use your phone or tablet as a microphone']].map(([i, t]) => `<div class="feature">${ic(i)}${t}</div>`).join('')}</div>
        <span class="sub" style="display:flex;align-items:center;gap:8px">${ic('lock')}Everything stays on your home network. No account.</span></div>`;
    } else if (st === 2) {
      const cert = !!L.wcert;
      const list = cert ? ['Scan and tap Allow.', 'Settings › General › VPN & Device Management › Install.', `Settings › General › About › Certificate Trust Settings › turn on full trust for “${S.authorityName || ''}”.`]
        : ['Open the camera on your phone or tablet.', 'Point it at the code.', 'Tap the link that appears, then click Allow on this computer.'];
      h += `<div style="display:flex;flex-direction:column;gap:18px"><div style="display:flex;flex-direction:column;gap:8px"><span class="h-lg">${cert ? 'Install the certificate' : "Scan with the camera of your phone or tablet"}</span>
          <span class="sub" style="font-size:14px;line-height:1.55">${cert ? 'Optional, once per device. It stops the browser warning about the connection. Android steps are on the Certificate page.' : "The remote opens in the device's browser. The device and the computer need to be on the same Wi-Fi."}</span></div>
        <div class="w-qr">${qrTile(cert ? S.certQr : S.qr, 156, false, !cert)}<div class="col" style="gap:10px">${steps(list)}</div></div>
        ${S.connected > 0 ? `<span class="pill tone-green" style="align-self:flex-start"><span class="dot"></span>${plural(S.connected, 'device', 'devices')} connected</span>` : ''}
        ${S.status === 'public' ? `<div class="note" style="background:var(--amber-bg)">${ic('shieldAlert')}<span>This network is marked Public, so devices are blocked. Finish, then fix it on the Connect page.</span></div>` : ''}
        <button class="btn ghost" style="align-self:flex-start;font-size:13px;font-weight:500" data-act="wcert">${ic(cert ? 'arrowL' : 'shieldCheck')}${cert ? 'Back to the pairing code' : 'Install certificate (optional)'}</button></div>`;
    } else {
      h += `<div style="display:flex;flex-direction:column;gap:18px"><div style="display:flex;flex-direction:column;gap:8px"><span class="h-lg">Start with Windows?</span><span class="sub" style="font-size:14px;line-height:1.55">The app waits quietly in the tray, so your phone or tablet can connect any time.</span></div>
        <div class="card rows"><div class="row" style="padding:16px 0"><div class="row-text"><span class="row-label">Start with Windows</span><span class="row-sub">You can change this later in Settings.</span></div>${toggle(S.startup, 'set', 'Start with Windows', 'startup')}</div>
          ${S.updatesEnabled ? `<div class="row" style="padding:16px 0"><div class="row-text"><span class="row-label">Install updates automatically (recommended)</span><span class="row-sub">When no device is connected. Off: the app tells you instead.</span></div>${toggle(L.wAuto !== false, 'wAuto', 'Install updates automatically')}</div>` : ''}</div>
        <div class="note" style="font-size:13px;padding:14px 16px">${ic('info')}<span>Closing this window keeps the app running in the tray next to the clock. Click the tray icon to show the QR code again.</span></div></div>`;
    }
    h += `<div style="flex:1"></div><div style="display:flex;align-items:center;gap:8px">${st > 1 ? '<button class="btn ghost lg" data-act="wPrev">Back</button>' : ''}<div style="flex:1"></div>
      ${st === 2 ? '<button class="btn ghost lg" data-act="wSkip">Skip</button>' : ''}<button class="btn primary lg" data-act="wNext" data-autofocus="w${st}">${st === 3 ? 'Finish' : st === 1 ? 'Get started' : 'Next'}</button></div></div></div>`;
    return h;
  }
  A.wNext = () => {
    if (L.step === 3) { S.welcomeDone = true; call('welcomeDone', { autoUpdate: L.wAuto !== false }); go('connect'); return; }
    L.step++; L.wcert = false; render();
  };
  A.wPrev = () => { L.step = Math.max(1, L.step - 1); render(); };
  A.wSkip = () => { L.step = 3; render(); };
  A.wcert = () => { L.wcert = !L.wcert; render(); };
  A.wAuto = () => { L.wAuto = L.wAuto === false; render(); };

  // ======================= QR code window =======================
  function qrWindow() {
    let h = `<div class="qrwin"><div class="page-head" style="gap:12px"><div class="row-text" style="gap:4px"><span class="h-win">Scan to connect</span><span class="sub">Open the camera on your phone or tablet and point it at the code.</span></div>${statusPill()}</div>`;
    const off = offlineOrError();
    if (off) return h + off + '</div>';
    const blocked = S.status === 'public';
    const px = blocked ? 140 : L.renew ? 160 : 220;
    h += publicBanner(true) + `<div class="qr-card">${qrTile(S.qr, px, blocked, true)}<div class="pc-line" style="margin-top:4px">${ic('computer')}${esc(S.pcName)}</div>
        <button class="addr-btn" data-act="copyLink" title="Copies the full link, with the pairing code">${esc(S.displayUrl || '')}<span class="copy${L.copied ? ' done' : ''}">${ic(L.copied ? 'check' : 'copy')}${L.copied ? 'Copied' : 'Copy'}</span></button></div>`;
    if (!blocked) h += `<div style="display:flex;gap:10px;align-items:flex-start;padding:0 4px"><span class="tone-sub" style="display:flex">${ic('shieldCheck')}</span><span class="sub small">Without the certificate, the device's browser shows a security warning first. <button class="btn link" style="height:auto;padding:0;font-size:12px;color:var(--txt)" data-act="show" data-arg="certificate">Install certificate</button></span></div>`;
    h += '<div style="flex:1"></div>';
    h += L.renew ? renewCard() : `<div style="display:flex;align-items:center;gap:8px"><button class="btn ghost" style="height:34px;font-size:13px;font-weight:500" data-act="askRenew">${ic('refresh')}New code</button><div style="flex:1"></div>
      <button class="btn secondary" style="height:34px;padding:0 14px" data-act="show" data-arg="settings">${ic('settings')}Open settings</button></div>`;
    return h + '</div>';
  }

  // ======================= Approval dialogs =======================
  function dialog() {
    const k = S.kind;
    if (!k) return ''; // data not here yet
    const head = (icon, title, sub) => `<div class="dlg-head"><span class="dlg-ic">${ic(icon)}</span><div class="row-text" style="gap:4px;padding-top:1px"><span style="font:600 16px/1.3 var(--sans);text-wrap:pretty">${title}</span><span class="sub">${sub}</span></div></div>`;
    const buttons = (yes) => `<div class="actions" style="padding-top:4px"><button class="btn secondary default" data-act="answer" data-arg="no" data-autofocus="dlg">Decline</button><button class="btn primary" data-act="answer" data-arg="yes">${yes}</button></div>`;
    if (k === 'pair') {
      return `<div class="dialog">${head(kindIcon(/iPad|tablet/.test(S.device || '') ? 'tablet' : 'phone'), `${esc(S.device)} wants to pair`, 'It scanned this computer\'s code. A paired device controls the mouse and keyboard, so allow it only if you know whose device it is.')}
        <div class="files"><div class="file">${ic('devices')}<span class="row-text" style="gap:1px"><span class="ellipsis" style="font:500 13px var(--sans)">${esc(S.device)}</span><span class="sub small">On your network at ${esc(S.address)}</span></span></div></div>
        <span class="dlg-note">${ic('info')}No answer in 2 minutes counts as Decline.</span>${buttons('Allow')}</div>`;
    }
    if (k === 'file') {
      return `<div class="dialog">${head('download', `${esc(S.device)} wants to send a file`, S.openFolder ? 'Save it into the folder that is open in File Explorer?' : "Save it on this computer? It's also pasted into the app that's in front.")}
        <div class="files"><div class="file">${ic('file')}<span class="ellipsis" style="flex:1;font:500 13px var(--sans)">${esc(S.fileName)}</span><span class="mono tone-sub" style="font-size:11.5px">${esc(S.size)}</span></div></div>
        <span class="dlg-note">${ic('folder')}<span class="ellipsis" style="flex:1">Saves to ${esc(S.folder)}</span>${S.openFolder ? '' : `<button class="btn link" style="height:auto;font-size:12.5px" data-act="changeFolder">Change</button>`}</span>${buttons('Save')}</div>`;
    }
    const items = S.items || [];
    const n = items.length + (S.more || 0);
    return `<div class="dialog">${head('upload', `A device wants to download ${plural(n, 'item', 'items')}, ${esc(S.total)}`, `${esc(S.device)} asked for these files. Only allow this if you asked for it on the device.`)}
      <div class="files">${items.map((f) => `<div class="file">${ic(f.folder ? 'folder' : 'file')}<span class="row-text" style="gap:1px"><span class="ellipsis" style="font:500 13px var(--sans)">${esc(f.name)}</span>${f.folder ? `<span class="sub small">${esc(f.files)}</span>` : ''}</span><span class="mono tone-sub" style="font-size:11.5px">${esc(f.size)}</span></div>`).join('')}
        ${S.more ? `<div class="file"><span class="sub small" style="padding-left:31px">and ${S.more} more</span></div>` : ''}</div>
      <span class="dlg-note">${ic(S.zip ? 'zip' : 'file')}${S.zip ? 'Sent to the device as one zip' : 'Sent to the device as is'} (${esc(String(S.count || '').toLowerCase())}).</span>
      ${S.large ? '<span class="dlg-note tone-amber">' + ic('alert') + 'Large download: it can take a while on Wi-Fi.</span>' : ''}${buttons('Allow')}</div>`;
  }
  A.answer = (v) => call('answer', { yes: v === 'yes' });

  // ======================= Help on a phone (/help) =======================
  function webHelp() {
    return `<div class="page"><a class="back" href="/" data-act="back">${ic('chevL')}Back to the remote</a>${help()}</div>`;
  }
  A.back = () => { if (history.length > 1) history.back(); else location.href = '/'; };

  // ---- Escape closes the innermost thing ----
  A.escape = () => {
    if (screen === 'dialog') return A.answer('no');
    if (L.reset) return A.cancelReset();
    if (L.renew) return A.cancelRenew();
    if (L.renaming) return A.cancelRename();
    if (L.addrOpen) { L.addrOpen = false; return render(); }
    if (L.micOpen) { L.micOpen = false; return render(); }
    if (L.art) return A.closeArt();
    if (L.q && currentPage() === 'help') return A.clearQ();
    if (screen === 'qr') call('close');
  };

  if (screen === 'dialog') document.body.classList.add('auto');
  render();
  call('ready');
})();