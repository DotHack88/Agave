/* ============================
   AgaveWMS – Database Layer
   Persistenza via localStorage + Server Sync
   ============================ */
const DB = (() => {
  const PREFIX = 'agavewms_';
  const KEYS = { products: 'products', movements: 'movements', users: 'users', settings: 'settings', counters: 'counters' };
  const API = '/api';

  // ── Helpers ──
  function load(key) {
    try { return JSON.parse(localStorage.getItem(PREFIX + key)) || null; } catch { return null; }
  }
  function save(key, data) {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  }
  function nextId(entity) {
    const c = load(KEYS.counters) || {};
    c[entity] = (c[entity] || 1000) + 1;
    save(KEYS.counters, c);
    return c[entity];
  }
  function genCode(prefix) {
    return prefix + String(nextId(prefix)).padStart(5, '0');
  }
  function now() { return new Date().toISOString(); }
  function today() { return new Date().toISOString().slice(0, 10); }

  // ── SERVER SYNC ──
  // Invia una mutation al server in background (fire & forget silenzioso)
  async function serverPost(method, path, body) {
    try {
      const res = await fetch(API + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[AgaveWMS] Server mutation failed (' + method + ' ' + path + '):', e.message);
      return null;
    }
  }

  // ── SYNC: Il server (data.json) è la UNICA fonte di verità ──
  // All'avvio: SEMPRE scarica dal server.
  // Dopo ogni mutazione: SEMPRE invia tutto al server.
  let _syncInProgress = false;

  async function pullFromServer() {
    try {
      const res = await fetch(API + '/initialize');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const serverData = await res.json();
      const serverProducts = serverData.products || [];
      const localProducts  = load(KEYS.products) || [];

      // Se il server è vuoto ma il locale ha dati → push iniziale (migrazione)
      if (serverProducts.length === 0 && localProducts.length > 0) {
        console.log('[AgaveWMS] 📤 Server vuoto, invio ' + localProducts.length + ' prodotti...');
        await pushToServer();
        return true;
      }

      // Altrimenti il server è la fonte di verità → scarica SEMPRE
      if (serverProducts.length > 0) {
        save(KEYS.products,  serverProducts);
      }
      if (serverData.movements)  save(KEYS.movements, serverData.movements);
      if (serverData.users && serverData.users.length > 0) save(KEYS.users, serverData.users);
      if (serverData.settings && Object.keys(serverData.settings).length > 0) save(KEYS.settings, serverData.settings);
      if (serverData.counters)   save(KEYS.counters,  serverData.counters);
      console.log('[AgaveWMS] ✅ Dati scaricati dal server (' + serverProducts.length + ' prodotti, ' + (serverData.movements || []).length + ' movimenti).');
      return true;
    } catch (e) {
      console.warn('[AgaveWMS] ⚠️ Sync server non disponibile, uso localStorage:', e.message);
      return false;
    }
  }

  // Invia TUTTO lo stato locale al server (dopo ogni mutazione)
  async function pushToServer() {
    if (_syncInProgress) return;
    _syncInProgress = true;
    try {
      await fetch(API + '/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products:  load(KEYS.products)  || [],
          movements: load(KEYS.movements) || [],
          users:     load(KEYS.users)     || [],
          settings:  load(KEYS.settings)  || {},
          counters:  load(KEYS.counters)  || {}
        })
      });
    } catch (e) {
      console.warn('[AgaveWMS] Push al server fallito:', e.message);
    } finally {
      _syncInProgress = false;
    }
  }

  // Polling: scarica dal server ogni 30 secondi per rimanere allineati
  setInterval(async () => {
    if (_syncInProgress) return;
    try {
      const res = await fetch(API + '/initialize');
      if (!res.ok) return;
      const serverData = await res.json();
      const serverProducts = serverData.products || [];
      if (serverProducts.length > 0) {
        save(KEYS.products,  serverProducts);
      }
      if (serverData.movements) save(KEYS.movements, serverData.movements);
      if (serverData.counters)  save(KEYS.counters,  serverData.counters);
      // Rinfresca la UI se l'utente è loggato
      if (typeof App !== 'undefined' && App.getUser && App.getUser()) {
        const section = document.querySelector('.nav-item.active')?.dataset?.section;
        if (section && typeof Sections !== 'undefined') {
          try { Sections.render(section); } catch(e) {}
        }
      }
    } catch(e) { /* silenzioso */ }
  }, 30000);

  // ── INIT ──
  function init() {
    // Default users (solo se localStorage completamente vuoto)
    if (!load(KEYS.users)) {
      save(KEYS.users, [
        { id: 1, username: 'admin', password: 'admin', name: 'Amministratore', role: 'admin', active: true, created: now() },
        { id: 2, username: 'magazziniere', password: '1234', name: 'Mario Rossi', role: 'warehouse', active: true, created: now() },
        { id: 3, username: 'operatore', password: '1234', name: 'Luca Bianchi', role: 'operator', active: true, created: now() },
        { id: 4, username: 'Daniele', password: 'Citerio', name: 'Daniele Citerio', role: 'admin', active: true, created: now() }
      ]);
    }
    // Default settings
    if (!load(KEYS.settings)) {
      save(KEYS.settings, {
        company: 'La Mia Azienda', currency: 'EUR', currencySymbol: '€',
        lowStockAlert: true, backupAuto: false, theme: 'dark', language: 'it',
        csvDelimiter: ',', defaultCategory: 'Generale'
      });
    }
    // Demo products (solo se non c'è nulla — verrà sovrascritta da syncFromServer)
    if (!load(KEYS.products)) {
      const demo = [
        { id: 1001, code: 'PRD01001', barcode: '8001234567890', name: 'Laptop Pro 15"', category: 'Informatica', brand: 'TechBrand', description: 'Laptop professionale 15 pollici', qty: 42, qtyMin: 10, priceBuy: 650, priceSell: 999, supplier: 'TechSupply Srl', location: 'A-01-01', active: true, created: now(), notes: '', image: '' },
        { id: 1002, code: 'PRD01002', barcode: '8009876543210', name: 'Mouse Wireless', category: 'Informatica', brand: 'LogiMouse', description: 'Mouse senza fili ergonomico', qty: 7, qtyMin: 15, priceBuy: 12, priceSell: 29, supplier: 'TechSupply Srl', location: 'A-01-02', active: true, created: now(), notes: '', image: '' },
        { id: 1003, code: 'PRD01003', barcode: '8005555555555', name: 'Tastiera Meccanica', category: 'Informatica', brand: 'KeyMaster', description: 'Tastiera meccanica RGB', qty: 23, qtyMin: 5, priceBuy: 45, priceSell: 89, supplier: 'ComputerParts Srl', location: 'A-02-01', active: true, created: now(), notes: '', image: '' },
        { id: 1004, code: 'PRD01004', barcode: '8007777777777', name: 'Monitor 27" 4K', category: 'Informatica', brand: 'ViewMax', description: 'Monitor UHD 4K HDR', qty: 3, qtyMin: 5, priceBuy: 280, priceSell: 499, supplier: 'TechSupply Srl', location: 'B-01-01', active: true, created: now(), notes: '', image: '' },
        { id: 1005, code: 'PRD01005', barcode: '8002222222222', name: 'Cuffie Bluetooth', category: 'Audio', brand: 'SoundPro', description: 'Cuffie wireless con ANC', qty: 18, qtyMin: 8, priceBuy: 55, priceSell: 129, supplier: 'AudioStore Srl', location: 'C-01-01', active: true, created: now(), notes: '', image: '' },
        { id: 1006, code: 'PRD01006', barcode: '8003333333333', name: 'Webcam Full HD', category: 'Informatica', brand: 'CamPro', description: 'Webcam 1080p con microfono', qty: 0, qtyMin: 5, priceBuy: 28, priceSell: 59, supplier: 'TechSupply Srl', location: 'A-02-02', active: true, created: now(), notes: 'Esaurito!', image: '' },
        { id: 1007, code: 'PRD01007', barcode: '8004444444444', name: 'Hub USB-C 7 Porte', category: 'Accessori', brand: 'HubMax', description: 'Hub USB-C con HDMI e lettore SD', qty: 31, qtyMin: 10, priceBuy: 22, priceSell: 49, supplier: 'ComputerParts Srl', location: 'A-03-01', active: true, created: now(), notes: '', image: '' },
        { id: 1008, code: 'PRD01008', barcode: '8006666666666', name: 'SSD Esterno 1TB', category: 'Storage', brand: 'SpeedDisk', description: 'SSD portatile USB-C 1TB', qty: 12, qtyMin: 6, priceBuy: 75, priceSell: 149, supplier: 'StoragePro Srl', location: 'B-02-01', active: true, created: now(), notes: '', image: '' }
      ];
      save(KEYS.products, demo);
      save(KEYS.counters, { PRD: 1008, MOV: 2000, USR: 10 });
      const moves = [];
      const now2 = new Date();
      for (let i = 0; i < 20; i++) {
        const d = new Date(now2); d.setDate(d.getDate() - i);
        const type = i % 3 === 0 ? 'out' : 'in';
        const pid = demo[i % demo.length];
        moves.push({
          id: 2001 + i, type, productId: pid.id, productCode: pid.code,
          productName: pid.name, qty: Math.floor(Math.random() * 10) + 1,
          priceBuy: pid.priceBuy, supplier: type === 'in' ? pid.supplier : '',
          customer: type === 'out' ? 'Cliente Demo' : '', document: 'DOC-' + (1000 + i),
          operator: 'admin', date: d.toISOString().slice(0, 10), ts: d.toISOString(), notes: ''
        });
      }
      save(KEYS.movements, moves);
    }

    // 🔄 Sync: scarica SEMPRE dal server all'avvio (fonte di verità)
    pullFromServer().then(synced => {
      if (synced && typeof App !== 'undefined' && App.getUser && App.getUser()) {
        const section = document.querySelector('.nav-item.active')?.dataset?.section || 'dashboard';
        if (typeof Sections !== 'undefined') {
          try { Sections.render(section); } catch(e) {}
        }
      }
    });
  }

  // ── PRODUCTS ──
  const Products = {
    all() { return load(KEYS.products) || []; },
    active() { return this.all().filter(p => p.active); },
    find(id) { return this.all().find(p => p.id === id); },
    findByCode(code) { return this.all().find(p => p.code === code || p.barcode === code); },
    search(q) {
      const s = q.toLowerCase();
      return this.active().filter(p =>
        (p.name || '').toLowerCase().includes(s) ||
        (p.code || '').toLowerCase().includes(s) ||
        (p.barcode || '').includes(s) ||
        (p.category || '').toLowerCase().includes(s) ||
        (p.brand || '').toLowerCase().includes(s) ||
        (p.model || '').toLowerCase().includes(s) ||
        (p.supplier || '').toLowerCase().includes(s)
      );
    },
    create(data) {
      const id = nextId('PRD');
      const protocol = nextId('PROT'); // Sequential protocol number
      const p = { id, protocol, code: data.code || genCode('PRD'), active: true, created: now(), qty: 0, ...data };
      const all = this.all(); all.push(p); save(KEYS.products, all);
      serverPost('POST', '/products', p); // sync to server
      return p;
    },
    update(id, data) {
      const all = this.all();
      const i = all.findIndex(p => p.id === id);
      if (i < 0) return null;
      all[i] = { ...all[i], ...data, id };
      save(KEYS.products, all);
      serverPost('PUT', '/products/' + id, all[i]); // sync to server
      return all[i];
    },
    delete(id) {
      const all = this.all().filter(p => p.id !== id);
      save(KEYS.products, all);
      serverPost('DELETE', '/products/' + id); // sync to server
    },
    deactivate(id) { return this.update(id, { active: false }); },
    duplicate(id) {
      const p = this.find(id); if (!p) return null;
      // Create a new product copy with a new ID, internal code, and protocol
      return this.create({
        ...p,
        id: undefined,
        // Generate an internal code with prefix 'INT'
        code: genCode('INT'),
        barcode: '',
        qty: 0,
        qtyMin: 0,
        created: undefined,
        protocol: undefined // will be set in create()
      });
    },
    updateQty(id, delta) {
      const p = this.find(id); if (!p) return;
      const newQty = Math.max(0, (p.qty || 0) + delta);
      return this.update(id, { qty: newQty });
    },
    lowStock() { return this.active().filter(p => p.qty <= p.qtyMin); },
    outOfStock() { return this.active().filter(p => p.qty === 0); },
    categories() { return [...new Set(this.active().map(p => p.category).filter(Boolean))].sort(); },
    brands() { return [...new Set(this.active().map(p => p.brand).filter(Boolean))].sort(); },
    suppliers() { return [...new Set(this.active().map(p => p.supplier).filter(Boolean))].sort(); },
    totalValue() { return this.active().reduce((s, p) => s + (p.qty * p.priceBuy), 0); },
    totalQty() { return this.active().reduce((s, p) => s + (p.qty || 0), 0); },
    filter(opts = {}) {
      let arr = this.active();
      if (opts.q) {
        const s = opts.q.toLowerCase();
        arr = arr.filter(p =>
          (p.name || '').toLowerCase().includes(s) ||
          (p.code || '').toLowerCase().includes(s) ||
          (p.barcode || '').includes(s) ||
          (p.brand || '').toLowerCase().includes(s) ||
          (p.model || '').toLowerCase().includes(s) ||
          (p.category || '').toLowerCase().includes(s) ||
          (p.supplier || '').toLowerCase().includes(s)
        );
      }
      if (opts.category) arr = arr.filter(p => p.category === opts.category);
      if (opts.brand) arr = arr.filter(p => p.brand === opts.brand);
      if (opts.supplier) arr = arr.filter(p => p.supplier === opts.supplier);
      if (opts.lowStock) arr = arr.filter(p => p.qty <= p.qtyMin);
      if (opts.outOfStock) arr = arr.filter(p => p.qty === 0);
      return arr;
    }
  };

  // ── MOVEMENTS ──
  const Movements = {
    all() {
      const arr = load(KEYS.movements) || [];
      const prods = load(KEYS.products) || [];
      arr.forEach(m => {
        if (!m.brand || !m.model) {
          const p = prods.find(pr => pr.id === m.productId);
          if (p) {
            if (!m.brand) m.brand = p.brand || '';
            if (!m.model) m.model = p.model || '';
          }
        }
      });
      return arr;
    },
    find(id) { return this.all().find(m => m.id === id); },
    create(data) {
      const id = nextId('MOV');
      const m = { id, ts: now(), date: today(), ...data };
      const all = this.all(); all.unshift(m); save(KEYS.movements, all);
      serverPost('POST', '/movements', m); // sync to server
      return m;
    },
    filter(opts = {}) {
      let arr = this.all();
      if (opts.type) arr = arr.filter(m => m.type === opts.type);
      if (opts.productId) arr = arr.filter(m => m.productId === opts.productId);
      if (opts.from) arr = arr.filter(m => m.date >= opts.from);
      if (opts.to) arr = arr.filter(m => m.date <= opts.to);
      if (opts.q) { const s = opts.q.toLowerCase(); arr = arr.filter(m => m.productName?.toLowerCase().includes(s) || m.productCode?.toLowerCase().includes(s) || m.brand?.toLowerCase().includes(s) || m.model?.toLowerCase().includes(s) || m.document?.toLowerCase().includes(s) || m.customer?.toLowerCase().includes(s) || m.supplier?.toLowerCase().includes(s)); }
      return arr;
    },
    byProduct() {
      const map = {};
      this.all().forEach(m => {
        if (!map[m.productId]) map[m.productId] = { in: 0, out: 0, name: m.productName, id: m.productId };
        map[m.productId][m.type] += m.qty;
      });
      return Object.values(map).sort((a, b) => (b.in + b.out) - (a.in + a.out));
    },
    monthlyStats(months = 6) {
      const result = [];
      const now2 = new Date();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now2.getFullYear(), now2.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
        const ins = this.all().filter(m => m.type === 'in' && m.date?.startsWith(key)).reduce((s, m) => s + m.qty, 0);
        const outs = this.all().filter(m => m.type === 'out' && m.date?.startsWith(key)).reduce((s, m) => s + m.qty, 0);
        result.push({ label, in: ins, out: outs });
      }
      return result;
    }
  };

  // ── USERS ──
  const Users = {
    all() { return load(KEYS.users) || []; },
    find(id) { return this.all().find(u => String(u.id) === String(id)); },
    authenticate(username, password) {
      const userLower = (username || '').trim().toLowerCase();
      const passTrim = (password || '').trim();
      const found = this.all().find(u => (u.username || '').toLowerCase() === userLower && u.password === passTrim && u.active);
      if (!found && userLower === 'admin' && passTrim === 'admin') {
        return { id: 1, username: 'admin', password: 'admin', name: 'Amministratore', role: 'admin', active: true };
      }
      return found;
    },
    create(data) {
      const id = nextId('USR');
      const u = { id, active: true, created: now(), ...data };
      const all = this.all(); all.push(u); save(KEYS.users, all); return u;
    },
    update(id, data) {
      const all = this.all();
      const i = all.findIndex(u => String(u.id) === String(id));
      if (i < 0) return null;
      all[i] = { ...all[i], ...data, id: all[i].id };
      save(KEYS.users, all); return all[i];
    },
    delete(id) { save(KEYS.users, this.all().filter(u => String(u.id) !== String(id))); },
    ROLES: { admin: 'Amministratore', warehouse: 'Magazziniere', operator: 'Operatore', viewer: 'Visualizzatore' },
    canEdit(user) { return true; },
    canDelete(user) { return true; },
    canImport(user) { return true; },
    canReport(user) { return true; }
  };

  // ── SETTINGS ──
  const Settings = {
    get() { return load(KEYS.settings) || {}; },
    set(data) { save(KEYS.settings, { ...this.get(), ...data }); }
  };

  // ── CSV IMPORT ──
  const CSV = {
    parse(text, delimiter = ',') {
      const lines = text.trim().split('\n');
      if (!lines.length) return { headers: [], rows: [] };
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, '').toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      }).filter(r => Object.values(r).some(v => v));
      return { headers, rows };
    },
    FIELD_MAP: {
      'codice': 'code', 'cod': 'code', 'product_code': 'code',
      'barcode': 'barcode', 'ean': 'barcode', 'cod_barre': 'barcode', 'codice a barre': 'barcode',
      'nome': 'name', 'name': 'name', 'prodotto': 'name', 'product': 'name', 'nome prodotto': 'name',
      'categoria': 'category', 'category': 'category', 'cat': 'category',
      'marca': 'brand', 'brand': 'brand', 'marchio': 'brand', 'marca prodotto': 'brand',
      'modello': 'model', 'model': 'model',
      'quantita': 'qty', 'quantity': 'qty', 'qta': 'qty', 'qty': 'qty', 'disponibilita': 'qty', 'disponibilita\'': 'qty', 'Disponibilita': 'qty',
      'quantita_minima': 'qtyMin', 'qty_min': 'qtyMin', 'scorta_min': 'qtyMin',
      'prezzo_acquisto': 'priceBuy', 'buy_price': 'priceBuy', 'costo': 'priceBuy',
      'prezzo_vendita': 'priceSell', 'sell_price': 'priceSell', 'prezzo': 'priceSell',
      'fornitore': 'supplier', 'supplier': 'supplier',
      'ubicazione': 'location', 'location': 'location', 'posizione': 'location',
      'descrizione': 'description', 'description': 'description', 'note': 'notes', 'notes': 'notes'
    },
    mapRow(rawRow) {
      const mapped = {};
      Object.entries(rawRow).forEach(([k, v]) => {
        const field = this.FIELD_MAP[k.toLowerCase()];
        if (field) mapped[field] = v;
      });
      return mapped;
    },
    validate(row) {
      const errors = [];
      if (!row.barcode) errors.push('Barcode mancante');
      if (!row.name) errors.push('Nome prodotto mancante');
      if (!row.brand) errors.push('Marca prodotto mancante');
      if (!row.model) errors.push('Modello prodotto mancante');
      // Le quantità errate (es. "ND", "La Saponaria") verranno automaticamente 
      // convertite in 0 durante l'import, per non bloccare l'intero file.
      return errors;
    },
    import(rows, operatorName) {
      const results = { created: 0, updated: 0, errors: [] };

      // Lavoriamo su copie in-memory per evitare scritture ripetute su localStorage (causa Out of Memory)
      const allProducts  = load(KEYS.products)  || [];
      const allMovements = load(KEYS.movements) || [];
      const counters     = load(KEYS.counters)  || {};

      function localNextId(entity) {
        counters[entity] = (counters[entity] || 1000) + 1;
        return counters[entity];
      }

      const parseNumVal = (val) => {
        if (val === undefined || val === '') return null;
        if (typeof val === 'string') {
          val = val.replace(',', '.');
          const floatVal = parseFloat(val);
          if (!isNaN(floatVal)) return floatVal;
        }
        return Number(val);
      };

      rows.forEach((rawRow, idx) => {
        const row = this.mapRow(rawRow);
        const errors = this.validate(row);
        if (errors.length) { results.errors.push({ row: idx + 2, errors }); return; }

        // Cerca esistente nella copia in-memory (non su localStorage ogni volta)
        const existing = row.code
          ? allProducts.find(p => p.code === row.code || p.barcode === row.barcode)
          : allProducts.find(p => p.barcode === row.barcode);

        const numRow = { ...row };
        const parsedQty = parseNumVal(row.qty);
        numRow.qty = (parsedQty !== null && !isNaN(parsedQty)) ? parsedQty : (existing ? existing.qty || 0 : 0);

        const parsedQtyMin = parseNumVal(row.qtyMin);
        numRow.qtyMin = (parsedQtyMin !== null && !isNaN(parsedQtyMin)) ? parsedQtyMin : (existing ? existing.qtyMin || 0 : 0);

        const parsedPriceBuy = parseNumVal(row.priceBuy);
        numRow.priceBuy = (parsedPriceBuy !== null && !isNaN(parsedPriceBuy)) ? parsedPriceBuy : (existing ? existing.priceBuy || 0 : 0);

        const parsedPriceSell = parseNumVal(row.priceSell);
        numRow.priceSell = (parsedPriceSell !== null && !isNaN(parsedPriceSell)) ? parsedPriceSell : (existing ? existing.priceSell || 0 : 0);

        if (existing) {
          const oldQty = existing.qty || 0;
          Object.assign(existing, numRow, { id: existing.id });
          const delta = (numRow.qty || 0) - oldQty;
          if (delta !== 0) {
            allMovements.unshift({
              id: localNextId('MOV'), ts: now(), date: today(),
              type: delta > 0 ? 'in' : 'out',
              productId: existing.id, productCode: existing.code,
              productName: numRow.name || existing.name,
              qty: Math.abs(delta),
              brand: numRow.brand || existing.brand || '',
              model: numRow.model || existing.model || '',
              operator: operatorName || 'admin',
              notes: delta > 0 ? 'Carico da importazione CSV' : 'Scarico da importazione CSV'
            });
          }
          results.updated++;
        } else {
          const id = localNextId('PRD');
          const protocol = localNextId('PROT');
          const p = { id, protocol, code: numRow.code || ('PRD' + String(id).padStart(5, '0')), active: true, created: now(), qty: 0, ...numRow };
          allProducts.push(p);
          if ((p.qty || 0) > 0) {
            allMovements.unshift({
              id: localNextId('MOV'), ts: now(), date: today(),
              type: 'in', productId: p.id, productCode: p.code,
              productName: p.name, qty: p.qty,
              brand: p.brand || '', model: p.model || '',
              operator: operatorName || 'admin',
              notes: 'Carico iniziale da importazione CSV'
            });
          }
          results.created++;
        }
      });

      // ✅ Salvataggio UNICO su localStorage (una sola scrittura, non una per prodotto)
      save(KEYS.products,  allProducts);
      save(KEYS.movements, allMovements);
      save(KEYS.counters,  counters);

      // ✅ Push UNICO al server (una sola richiesta HTTP)
      serverPost('POST', '/bulk-import', {
        products:  allProducts,
        movements: allMovements,
        users:     load(KEYS.users)    || [],
        settings:  load(KEYS.settings) || {},
        counters:  counters
      });

      return results;
    },

    template() {
      return 'codice,barcode,nome,categoria,marca,quantita,quantita_minima,prezzo_acquisto,prezzo_vendita,fornitore,ubicazione,descrizione\n' +
        'PRD001,8001234567890,Esempio Prodotto,Categoria,Marca,10,5,10.00,19.99,Fornitore Srl,A-01-01,Descrizione prodotto\n';
    }
  };

  // ── LOCAL BACKUP MANAGEMENT ──
  const LocalBackup = {
    async saveDirectoryHandle(handle) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('agave_backup_db', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('handles');
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('handles', 'readwrite');
          const store = tx.objectStore('handles');
          const req = store.put(handle, 'backup_dir');
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        };
        request.onerror = () => reject(request.error);
      });
    },

    async getDirectoryHandle() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('agave_backup_db', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('handles');
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('handles', 'readonly');
          const store = tx.objectStore('handles');
          const req = store.get('backup_dir');
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        };
        request.onerror = () => reject(request.error);
      });
    },

    async verifyPermission(fileHandle, readWrite) {
      const options = {};
      if (readWrite) {
        options.mode = 'readwrite';
      }
      if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
      }
      if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
      }
      return false;
    },

    async executeBackup(isAuto = false) {
      const handle = await this.getDirectoryHandle();
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
      const dateStr = new Date().toISOString().slice(0, 10);

      let gotPermission = false;
      if (handle) {
        try {
          gotPermission = await this.verifyPermission(handle, true);
        } catch (e) {
          console.warn("Could not request directory permissions:", e);
        }
      }

      const dbData = {
        version: '1.0',
        exported: new Date().toISOString(),
        products: Products.all(),
        movements: Movements.all(),
        users: Users.all(),
        settings: Settings.get()
      };

      if (handle && gotPermission) {
        try {
          const jsonFileHandle = await handle.getFileHandle(`agave_db_backup_${timestamp}.json`, { create: true });
          const jsonWritable = await jsonFileHandle.createWritable();
          await jsonWritable.write(JSON.stringify(dbData, null, 2));
          await jsonWritable.close();

          try {
            const response = await fetch(`${window.location.origin}/api/backup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ timestamp: new Date().toISOString() })
            });
            if (response.ok) {
              const zipBlob = await response.blob();
              const zipFileHandle = await handle.getFileHandle(`agave_app_backup_${timestamp}.zip`, { create: true });
              const zipWritable = await zipFileHandle.createWritable();
              await zipWritable.write(zipBlob);
              await zipWritable.close();
            }
          } catch (err) {
            console.warn("Vercel api/backup zip skipped:", err);
          }

          if (!isAuto) {
            App.toast(`💾 Backup salvato in: ${handle.name}`, 'success');
          }
          return true;
        } catch (err) {
          console.error("Backup to folder failed:", err);
          if (!isAuto) {
            App.toast(`❌ Errore nel salvataggio del backup: ${err.message}`, 'error');
          }
        }
      }

      if (!isAuto) {
        try {
          const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `agave_db_backup_${dateStr}.json`;
          a.click();
          URL.revokeObjectURL(a.href);

          App.toast('💾 Backup scaricato nella cartella dei download', 'success');
          return true;
        } catch (err) {
          console.error("Browser download fallback failed:", err);
          App.toast('❌ Errore nel download del backup', 'error');
          return false;
        }
      }
      return false;
    },

    async checkAutoBackup() {
      const handle = await this.getDirectoryHandle();
      if (!handle) return;

      const nowVal = new Date();
      const hours = nowVal.getHours();

      if (hours >= 19) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const lastBackupDate = localStorage.getItem('agavewms_last_auto_backup_date');

        if (lastBackupDate !== todayStr) {
          localStorage.setItem('agavewms_last_auto_backup_date', todayStr);
          App.toast('⏰ Avvio backup automatico...', 'info');
          await this.executeBackup(true);
        }
      }
    }
  };

  // ── BACKUP ──
  const Backup = {
    dailyBackup() {
      const todayStr = today();
      const key = PREFIX + 'backup_daily_' + todayStr;
      if (!localStorage.getItem(key)) {
        const data = {
          version: '1.0', exported: now(),
          products: Products.all(), movements: Movements.all(),
          users: Users.all(), settings: Settings.get(), counters: load(KEYS.counters)
        };
        localStorage.setItem(key, JSON.stringify(data));
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX + 'backup_daily_')).sort();
        if (allKeys.length > 7) {
          for (let i = 0; i < allKeys.length - 7; i++) {
            localStorage.removeItem(allKeys[i]);
          }
        }
      }
    },
    autoBackup() {
      const data = {
        version: '1.0', exported: now(),
        products: Products.all(),
        movements: Movements.all(),
        users: Users.all(),
        settings: Settings.get(),
        counters: load(KEYS.counters)
      };
      localStorage.setItem(PREFIX + 'backup_auto', JSON.stringify(data));
      localStorage.setItem(PREFIX + 'backup_auto_time', now());
    },
    getAutoBackupTime() {
      return localStorage.getItem(PREFIX + 'backup_auto_time') || null;
    },
    checkAutoDownloadBackup() {
      const nowVal = new Date();
      const hours = nowVal.getHours();
      if (hours >= 19) {
        const todayStr = today();
        const key = PREFIX + 'last_auto_download_backup_date';
        const lastBackupDate = localStorage.getItem(key);
        if (lastBackupDate !== todayStr) {
          localStorage.setItem(key, todayStr);
          setTimeout(() => {
            Backup.export();
            if (typeof App !== 'undefined' && typeof App.openModal === 'function') {
              App.openModal('💾 Backup Automatico delle 19:00', `
                <div style="text-align:center;padding:10px 0">
                  <div style="font-size:3rem;margin-bottom:12px">💾</div>
                  <h3 style="margin-bottom:8px">Backup Automatico Eseguito!</h3>
                  <p style="color:var(--text2);font-size:.9rem;line-height:1.5">
                    È stato avviato il download automatico del database.<br>
                    <b>Sposta il file appena scaricato nella cartella del Desktop del PC del negozio.</b>
                  </p>
                </div>
              `, `
                <button class="btn btn-primary" onclick="App.closeModal()">Ho capito</button>
              `);
            }
          }, 1000);
        }
      }
    },
    restoreAutoBackup() {
      const text = localStorage.getItem(PREFIX + 'backup_auto');
      if (!text) return false;
      const data = JSON.parse(text);
      if (data.products) save(KEYS.products, data.products);
      if (data.movements) save(KEYS.movements, data.movements);
      if (data.users) save(KEYS.users, data.users);
      if (data.settings) save(KEYS.settings, data.settings);
      if (data.counters) save(KEYS.counters, data.counters);
      return true;
    },
    export() {
      const data = {
        version: '1.0', exported: now(),
        products: Products.all(),
        movements: Movements.all(),
        users: Users.all(),
        settings: Settings.get()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `agavewms_backup_${today()}.json`;
      a.click();
    },
    import(text) {
      const data = JSON.parse(text);
      if (data.products) save(KEYS.products, data.products);
      if (data.movements) save(KEYS.movements, data.movements);
      if (data.users) save(KEYS.users, data.users);
      if (data.settings) save(KEYS.settings, data.settings);
      return true;
    }
  };

  // Helper to trigger backup + server push after mutation
  function mutate(fn) {
    return function (...args) {
      const res = fn.apply(this, args);
      Backup.autoBackup();
      pushToServer(); // 🔄 Sync immediato al server dopo ogni modifica
      return res;
    };
  }

  // Wrap mutations
  Products.create = mutate(Products.create);
  Products.update = mutate(Products.update);
  Products.delete = mutate(Products.delete);
  Products.updateQty = mutate(Products.updateQty);
  Movements.create = mutate(Movements.create);
  Users.create = mutate(Users.create);
  Users.update = mutate(Users.update);
  Users.delete = mutate(Users.delete);

  init();
  Backup.dailyBackup();
  return { Products, Movements, Users, Settings, CSV, Backup, LocalBackup };
})();
