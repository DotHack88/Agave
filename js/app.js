/* ============================
   AgaveWMS – Main Application
   ============================ */
const App = (() => {
  let currentUser = null;
  let currentSection = 'dashboard';
  let sidebarOpen = true;

  // ── AUTH ──
  function login() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const found = DB.Users.authenticate(user, pass);
    if (!found) {
      document.getElementById('login-error').classList.remove('hidden');
      return;
    }
    currentUser = found;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-name-display').textContent = found.name;
    document.getElementById('user-role-display').textContent = DB.Users.ROLES[found.role] || found.role;
    document.getElementById('user-avatar').textContent = found.name[0].toUpperCase();
    applyTheme(DB.Settings.get().theme || 'dark');
    navigate('dashboard');
    updateNotifications();
  }

  function logout() {
    currentUser = null;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-error').classList.add('hidden');
  }

  function getUser() { return currentUser; }

  // ── THEME ──
  function applyTheme(t) {
    document.body.classList.remove('dark','light');
    document.body.classList.add(t || 'dark');
  }
  function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    const t = isDark ? 'light' : 'dark';
    applyTheme(t);
    DB.Settings.set({ theme: t });
  }

  // ── SIDEBAR ──
  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const mc = document.querySelector('.main-content');
    if (window.innerWidth <= 768) {
      sb.classList.toggle('open');
    } else {
      sidebarOpen = !sidebarOpen;
      sb.classList.toggle('collapsed', !sidebarOpen);
      mc.classList.toggle('expanded', !sidebarOpen);
    }
  }

  // ── NAVIGATION ──
  function navigate(section, el) {
    currentSection = section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const sec = document.getElementById('section-' + section);
    if (sec) sec.classList.add('active');
    if (el) el.classList.add('active');
    else {
      const navEl = document.querySelector(`.nav-item[data-section="${section}"]`);
      if (navEl) navEl.classList.add('active');
    }
    const titles = { dashboard:'Dashboard', products:'Prodotti', inbound:'Entrata Merci',
      outbound:'Uscita Merci', movements:'Movimenti Magazzino', csv:'Importa CSV',
      reports:'Report & Statistiche', settings:'Impostazioni' };
    document.getElementById('page-title').textContent = titles[section] || section;
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('global-search').value = '';
    // Close mobile sidebar
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    // Render section
    Sections.render(section);
  }

  // ── GLOBAL SEARCH ──
  function globalSearch(q) {
    const box = document.getElementById('search-results');
    if (!q || q.length < 2) { box.classList.add('hidden'); return; }
    const results = DB.Products.search(q).slice(0, 8);
    if (!results.length) { box.innerHTML = '<div style="padding:16px;color:var(--text2);font-size:.85rem;text-align:center">Nessun prodotto trovato</div>'; box.classList.remove('hidden'); return; }
    box.innerHTML = results.map(p => {
      const low = p.qty <= p.qtyMin;
      return `<div class="search-result-item" onclick="App.navigate('products');Sections.editProduct(${p.id})">
        <div style="flex:1">
          <div class="sri-code">${p.code}</div>
          <div class="sri-name">${p.name}</div>
          <div class="sri-qty ${low?'low':''}">${p.qty} pz ${low?'⚠ Scorta bassa':''}</div>
        </div>
        <div style="font-size:.75rem;color:var(--text2)">${p.category}</div>
      </div>`;
    }).join('');
    box.classList.remove('hidden');
  }

  // ── NOTIFICATIONS ──
  function updateNotifications() {
    const low = DB.Products.lowStock();
    const out = DB.Products.outOfStock();
    const total = low.length + out.length;
    const badge = document.getElementById('notif-count');
    badge.textContent = total;
    badge.setAttribute('data-count', total);
    badge.style.display = total > 0 ? 'flex' : 'none';
  }

  function toggleNotifications() {
    const panel = document.getElementById('notif-panel');
    if (panel.classList.contains('hidden')) {
      const low = DB.Products.lowStock();
      const out = DB.Products.outOfStock();
      let html = '';
      out.forEach(p => {
        html += `<div class="notif-item danger"><div class="notif-icon">🚫</div><div class="notif-text"><div class="notif-title">${p.name}</div><div class="notif-sub">Prodotto ESAURITO</div></div></div>`;
      });
      low.filter(p => p.qty > 0).forEach(p => {
        html += `<div class="notif-item warning"><div class="notif-icon">⚠️</div><div class="notif-text"><div class="notif-title">${p.name}</div><div class="notif-sub">Scorta bassa: ${p.qty}/${p.qtyMin}</div></div></div>`;
      });
      if (!html) html = '<div style="padding:16px;color:var(--text2);font-size:.85rem;text-align:center">Nessuna notifica</div>';
      panel.innerHTML = html;
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  }

  // ── TOAST ──
  function toast(msg, type = 'success', duration = 3000) {
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]||''}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(50px)'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, duration);
  }

  // ── MODAL ──
  function openModal(title, bodyHTML, footerHTML, wide = false) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML || '';
    document.getElementById('modal-box').classList.toggle('wide', wide);
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-footer').innerHTML = '';
  }

  // ── CONFIRM DIALOG ──
  function confirm(msg, onYes) {
    openModal('Conferma', `<p style="color:var(--text2)">${msg}</p>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
       <button class="btn btn-danger" onclick="App.closeModal();(${onYes.toString()})()">Conferma</button>`);
  }

  // ── FORMAT HELPERS ──
  function fmt(n, dec=2) {
    const s = DB.Settings.get();
    return new Intl.NumberFormat('it-IT',{style:'currency',currency:s.currency||'EUR',minimumFractionDigits:dec}).format(n||0);
  }
  function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
  }
  function fmtDateTime(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  function escape(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── BARCODE SCANNER DETECTOR ──
  let barcodeBuffer = '';
  let lastKeyTime = 0;

  function initBarcodeScanner() {
    document.addEventListener('keydown', e => {
      // Ignore key events if focused in an input field (unless it's Enter)
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        if (e.key !== 'Enter') return;
      }

      const now = Date.now();
      // USB scanners usually send keystrokes extremely fast (<35ms interval)
      if (now - lastKeyTime > 50) {
        barcodeBuffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) {
          handleBarcodeScanned(barcodeBuffer);
          barcodeBuffer = '';
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    });
  }

  function handleBarcodeScanned(code) {
    const p = DB.Products.findByCode(code);
    if (p) {
      toast(`Rilevato codice a barre: ${code} (${p.name})`, 'info');
      // Open action modal
      openModal('Prodotto Rilevato', `
        <div style="text-align:center;padding:10px 0">
          <div style="font-size:2rem;margin-bottom:8px">📦</div>
          <h3 style="margin-bottom:6px">${escape(p.name)}</h3>
          <p style="color:var(--text2);font-size:.85rem;margin-bottom:12px">Codice: ${p.code} | Barcode: ${p.barcode}</p>
          <p style="font-size:1.1rem;font-weight:700">Disponibilità: <span class="badge badge-primary">${p.qty} pz</span></p>
        </div>
      `, `
        <button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
        <button class="btn btn-danger" onclick="App.closeModal();App.navigate('outbound');Sections.prefillOutbound(${p.id})">📤 Scarica</button>
        <button class="btn btn-success" onclick="App.closeModal();App.navigate('inbound');Sections.prefillInbound(${p.id})">📥 Carica</button>
        <button class="btn btn-primary" onclick="App.closeModal();App.navigate('products');Sections.editProduct(${p.id})">✏️ Modifica</button>
      `);
    } else {
      toast(`Codice non trovato: ${code}`, 'warning');
      openModal('Nuovo Prodotto da Barcode', `
        <p style="color:var(--text2)">Nessun prodotto trovato con codice/barcode <b>${escape(code)}</b>.</p>
        <p style="color:var(--text2);margin-top:8px">Vuoi creare una nuova anagrafica associata a questo codice?</p>
      `, `
        <button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
        <button class="btn btn-primary" onclick="App.closeModal();App.navigate('products');Sections.openProductForm({barcode:'${escape(code)}'})">🆕 Crea Prodotto</button>
      `);
    }
  }

  // ── KEY LISTENERS ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('notif-panel').classList.add('hidden');
      document.getElementById('search-results').classList.add('hidden');
    }
    if ((e.ctrlKey||e.metaKey) && e.key === '/') {
      document.getElementById('global-search').focus();
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#notif-bell')) document.getElementById('notif-panel').classList.add('hidden');
    if (!e.target.closest('.search-bar') && !e.target.closest('#search-results')) document.getElementById('search-results').classList.add('hidden');
  });

  // Enter key on login
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key==='Enter') login(); });
  document.getElementById('login-user').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('login-pass').focus(); });

  // Init barcode scanner detector
  initBarcodeScanner();

  return { login, logout, getUser, navigate, toggleTheme, toggleSidebar, globalSearch, toast, openModal, closeModal, confirm, updateNotifications, toggleNotifications, fmt, fmtDate, fmtDateTime, escape, handleBarcodeScanned };
})();
