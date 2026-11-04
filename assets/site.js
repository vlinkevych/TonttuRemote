// Tonttu website. No analytics, no third-party scripts. Reads /update.json (the app's own update file, same
// origin) for the current installer: version, direct download link. Falls back to the GitHub releases page.
(function () {
  'use strict';
  var RELEASES = document.documentElement.getAttribute('data-releases') || 'https://github.com/vlinkevych/TonttuRemote/releases';
  var SITE = location.origin;
  var ua = navigator.userAgent || '';
  var isWindows = /Windows NT/.test(ua) && !/Windows Phone/.test(ua);
  var isMobile = /Android|iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  document.documentElement.classList.add(isWindows ? 'visitor-windows' : 'visitor-other');
  // Umami (cookie-less page views; present only when the build has a website id). Custom events go through here.
  function track(name, data) { try { if (window.umami && window.umami.track) window.umami.track(name, data || {}); } catch (e) {} }
  track('visitor', { kind: isWindows ? 'windows' : isMobile ? 'mobile' : 'other' });

  // ---- Header menu (phone) ----
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.site-nav a').forEach(function (a) { a.addEventListener('click', function () { header.classList.remove('open'); }); });
  }

  // ---- The installer: version and link from update.json ----
  var installer = { url: RELEASES + '/latest', version: '', size: 0 };
  function fmtMb(n) { return n ? (n / 1048576).toFixed(0) + ' MB' : ''; }
  function applyInstaller() {
    document.querySelectorAll('[data-dl-link]').forEach(function (a) { a.setAttribute('href', installer.url); });
    document.querySelectorAll('[data-dl-version]').forEach(function (el) {
      if (installer.version) el.textContent = installer.version + (installer.size ? ' · ' + fmtMb(installer.size) : '');
    });
  }
  applyInstaller();
  if (window.fetch) {
    fetch('/update.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
      if (!m || !m.channels) return;
      var rel = m.channels.stable || m.channels.beta;
      if (rel && rel.url && /^https:\/\/(github\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com)\//.test(rel.url)) {
        installer = { url: rel.url, version: rel.version || '', size: rel.size || 0 };
        applyInstaller();
      }
    }).catch(function () {});
  }

  // ---- Download buttons: start the download, then open the install guide ----
  function startDownload(ev) {
    var a = ev.currentTarget;
    if (!isWindows && a.hasAttribute('data-dl-main')) return; // on phones the main button shares the link instead
    if (/\/releases\/latest$/.test(installer.url)) return; // no manifest: the releases page opens normally
    ev.preventDefault();
    track('download-start', { version: installer.version || 'latest', place: a.getAttribute('data-umami-event-place') || '' });
    var link = document.createElement('a');
    link.href = installer.url; link.rel = 'noopener'; link.style.display = 'none';
    document.body.appendChild(link); link.click(); link.remove();
    if (!/\/install\/?$/.test(location.pathname)) setTimeout(function () { location.href = '/install?started=1'; }, 400);
    else showBanner();
  }
  document.querySelectorAll('[data-dl-link]').forEach(function (a) { a.addEventListener('click', startDownload); });

  // Phone or tablet visitor: the main button sends the site link to the PC.
  document.querySelectorAll('[data-dl-main]').forEach(function (a) {
    if (isWindows) return;
    a.textContent = 'Send link to your PC';
    a.classList.remove('primary'); a.classList.add('primary');
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      track('send-link');
      var data = { title: 'Tonttu', text: 'Tonttu: control your PC from your phone. Install it on the Windows PC:', url: SITE + '/' };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(SITE + '/').then(function () { flash(a, 'Link copied'); }, function () { prompt('Copy this link and open it on the PC:', SITE + '/'); });
      } else prompt('Copy this link and open it on the PC:', SITE + '/');
    });
  });
  function flash(el, text) { var old = el.textContent; el.textContent = text; setTimeout(function () { el.textContent = old; }, 1800); }

  // Which FAQ and troubleshooting questions get opened (the question text, nothing else).
  document.querySelectorAll('.faq details, .trouble details').forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) { var s = d.querySelector('summary'); track('question-open', { q: (s ? s.textContent : '').trim().slice(0, 80) }); } });
  });
  // Which sections of the home page get seen (once per visit each).
  if ('IntersectionObserver' in window) {
    var seen = {};
    var so = new IntersectionObserver(function (entries) { entries.forEach(function (e) { if (e.isIntersecting && !seen[e.target.id]) { seen[e.target.id] = true; track('section-seen', { id: e.target.id }); } }); }, { threshold: 0.4 });
    document.querySelectorAll('section[id], .feature[id], .gstep[id]').forEach(function (s) { so.observe(s); });
  }

  // ---- Install guide ----
  var banner = document.querySelector('.dl-banner');
  function showBanner() { if (banner) banner.classList.add('show'); }
  if (banner && /[?&]started=1/.test(location.search)) showBanner();
  var tocLinks = document.querySelectorAll('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { tocLinks.forEach(function (a) { a.classList.remove('on'); }); if (map[e.target.id]) map[e.target.id].classList.add('on'); } });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.gstep[id]').forEach(function (s) { io.observe(s); });
  }
  document.querySelectorAll('.seg').forEach(function (seg) {
    seg.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-selected', 'true');
        track('cert-tab', { tab: b.getAttribute('data-tab') });
        var group = seg.getAttribute('data-tabs');
        document.querySelectorAll('.tabpane[data-tabs="' + group + '"]').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-tab') === b.getAttribute('data-tab')); });
      });
    });
  });
  // A phone visitor on the guide most likely holds the device the certificate goes on: preselect its tab.
  if (/Android/.test(ua)) { var ab = document.querySelector('.seg button[data-tab="android"]'); if (ab) ab.click(); }

  // ---- Contact form: POST to the Worker (cloudflare/contact-worker.js); if that fails, hand over to the mail app ----
  var form = document.getElementById('contactForm');
  if (form) {
    var API = form.getAttribute('data-api') || 'https://api.tontturemote.app/contact';
    var state = document.getElementById('formState');
    var EMAIL = form.getAttribute('data-email') || 'feedback@tontturemote.app';
    var SECURITY = form.getAttribute('data-security') || 'security@tontturemote.app';
    var MAX_FILES = 5, MAX_FILE = 10 * 1024 * 1024, MAX_TOTAL = 14 * 1024 * 1024;
    var PLACEHOLDER = { Bug: 'What happened, and what did you expect? Steps to reproduce help a lot.', Idea: 'What would you like Tonttu to do, and when would you use it?', Feedback: 'What do you like, and what would make Tonttu better?', Security: 'What did you find, and how can it be reproduced?' };
    var EMAIL_HINT = { Bug: 'Leave your email if you’d like me to follow up.', Idea: 'Leave your email if you’d like to hear about this idea.', Feedback: 'Leave your email if you’d like a reply.', Security: 'Reports are handled privately. Leave your email so I can follow up while it gets fixed.' };
    var RATING = ['Tap a star', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
    var files = [];
    function typeOf() { return (form.querySelector('input[name=type]:checked') || {}).value || 'Feedback'; }
    function setState(kind, html) { state.className = 'form-state show' + (kind === 'error' ? ' error' : ''); state.innerHTML = html; state.scrollIntoView({ block: 'nearest' }); }
    function clearState() { state.className = 'form-state'; state.innerHTML = ''; }
    function applyType() {
      var ty = typeOf();
      form.message.placeholder = PLACEHOLDER[ty];
      form.querySelector('.email-hint').textContent = EMAIL_HINT[ty];
      form.querySelector('.only-feedback').hidden = ty !== 'Feedback';
      form.querySelector('.only-security').hidden = ty !== 'Security';
      form.querySelector('.attach-field').hidden = ty === 'Security';
      if (ty === 'Security') { files = []; renderFiles(); }
    }
    form.querySelectorAll('input[name=type]').forEach(function (r) { r.addEventListener('change', applyType); });
    applyType();

    // Stars and the testimonial consent (Feedback only).
    var stars = form.querySelectorAll('.stars button');
    function setRating(n) {
      form.rating.value = n;
      stars.forEach(function (s, i) { s.classList.toggle('on', i < n); s.setAttribute('aria-checked', i + 1 === n ? 'true' : 'false'); });
      form.querySelector('.star-label').textContent = RATING[n];
    }
    stars.forEach(function (s) { s.addEventListener('click', function () { setRating(+s.getAttribute('data-star')); }); });
    form.allowPublish.addEventListener('change', function () { form.querySelector('.publish-name').hidden = !form.allowPublish.checked; });

    // Attachments: up to 5 files, PNG/JPG/MP4, 10 MB each.
    var fileList = document.getElementById('fileList');
    function fmt(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
    function renderFiles() {
      fileList.innerHTML = '';
      files.forEach(function (f, i) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="name"></span><span class="size"></span><button type="button" aria-label="Remove attachment">✕</button>';
        li.querySelector('.name').textContent = f.name; li.querySelector('.size').textContent = fmt(f.size);
        li.querySelector('button').addEventListener('click', function () { files.splice(i, 1); renderFiles(); });
        fileList.appendChild(li);
      });
    }
    form.attachments.addEventListener('change', function () {
      var picked = Array.from(form.attachments.files || []); form.attachments.value = '';
      var rejected = [];
      picked.forEach(function (f) {
        if (!/^(image\/png|image\/jpeg|video\/mp4)$/.test(f.type)) rejected.push(f.name + ' (only PNG, JPG and MP4)');
        else if (f.size > MAX_FILE) rejected.push(f.name + ' (over 10 MB)');
        else if (files.length >= MAX_FILES) rejected.push(f.name + ' (5 files at most)');
        else files.push(f);
      });
      renderFiles();
      if (rejected.length) setState('error', 'Not added: ' + rejected.join(', ') + '.'); else clearState();
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ty = typeOf();
      var data = {
        type: ty,
        message: form.message.value.trim(),
        email: form.email.value.trim(),
        device: form.device.value,
        appVersion: form.appVersion.value.trim(),
        rating: ty === 'Feedback' ? form.rating.value : '0',
        allowPublish: ty === 'Feedback' && form.allowPublish.checked ? '1' : '',
        publicName: ty === 'Feedback' && form.allowPublish.checked ? form.publicName.value.trim() : '',
        website: form.website.value
      };
      if (data.website) return; // honeypot
      track('contact-submit', { type: ty });
      var errEl = form.querySelector('.field-error');
      if (!data.message) { errEl.hidden = false; form.message.focus(); return; }
      errEl.hidden = true;
      var total = files.reduce(function (s, f) { return s + f.size; }, 0);
      if (total > MAX_TOTAL) { setState('error', 'The attachments add up to more than 14 MB. Remove one, or send it by email.'); return; }
      var turnstile = form.querySelector('[name="cf-turnstile-response"]');
      if (form.querySelector('.cf-turnstile') && !(turnstile && turnstile.value)) { setState('error', 'One moment: the spam check hasn\'t finished. Please try again.'); return; }
      var body = new FormData();
      Object.keys(data).forEach(function (k) { body.append(k, data[k]); });
      if (turnstile && turnstile.value) body.append('cf-turnstile-response', turnstile.value);
      files.forEach(function (f) { body.append('attachments', f, f.name); });
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Sending…';
      var done = false;
      function finish() { btn.disabled = false; btn.textContent = 'Send message'; }
      function viaMail() {
        var to = ty === 'Security' ? SECURITY : EMAIL;
        var text = data.message + '\n\n' + (data.device ? 'Device: ' + data.device + '\n' : '') + (data.appVersion ? 'App version: ' + data.appVersion + '\n' : '') + (+data.rating ? 'Rating: ' + data.rating + '/5\n' : '');
        location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('[' + ty + '] Tonttu') + '&body=' + encodeURIComponent(text);
        setState('ok', '<b>Your email app should open with the message filled in.</b> If it didn\'t, send it to <a href="mailto:' + to + '">' + to + '</a>.' + (files.length ? ' Attach the files there yourself.' : ''));
        finish();
      }
      function sent() {
        var note = ty === 'Feedback' && data.allowPublish ? 'Thanks for the review. It may appear on the website as ' + (data.publicName || 'Tonttu user') + '.'
          : data.email ? 'I read every message. If you asked something, the reply goes to ' + data.email + '.'
          : 'I read every message. You left no email address, so there will be no reply.';
        document.getElementById('sentNote').textContent = note;
        form.hidden = true; document.getElementById('formSent').hidden = false;
        form.reset(); files = []; renderFiles(); setRating(0); clearState(); applyType(); finish();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      var timer = setTimeout(function () { if (!done) { done = true; viaMail(); } }, files.length ? 120000 : 8000);
      fetch(API, { method: 'POST', body: body }).then(function (r) {
        if (done) return; done = true; clearTimeout(timer);
        if (r.ok) sent();
        else if (r.status === 429) { setState('error', 'Too many messages from this connection for now. Please try again in an hour, or email ' + EMAIL + '.'); finish(); }
        else if (r.status === 413) { setState('error', 'The attachments are too large for the form. Remove one, or email them to ' + EMAIL + '.'); finish(); }
        else if (r.status === 403) { setState('error', 'The spam check didn\'t pass. Reload the page and try again, or email ' + EMAIL + '.'); finish(); }
        else viaMail();
      }).catch(function () { if (done) return; done = true; clearTimeout(timer); viaMail(); });
    });
    document.getElementById('sendAnother').addEventListener('click', function () { document.getElementById('formSent').hidden = true; form.hidden = false; form.message.focus(); });
  }
})();
