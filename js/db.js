/* ============================
   AgaveWMS – Database Layer
   Persistenza via localStorage
   ============================ */
const DB = (() => {
  const PREFIX = 'agavewms_';
  const KEYS = { products:'products', movements:'movements', users:'users', settings:'settings', counters:'counters' };

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
    return prefix + String(nextId(prefix)).padStart(5,'0');
  }
  function now() { return new Date().toISOString(); }
  function today() { return new Date().toISOString().slice(0,10); }

  // ── INIT ──
  function init() {
    // Default users
    if (!load(KEYS.users)) {
      save(KEYS.users, [
        { id:1, username:'admin', password:'admin', name:'Amministratore', role:'admin', active:true, created:now() },
        { id:2, username:'magazziniere', password:'1234', name:'Mario Rossi', role:'warehouse', active:true, created:now() },
        { id:3, username:'operatore', password:'1234', name:'Luca Bianchi', role:'operator', active:true, created:now() },
        { id:4, username:'Daniele', password:'Citerio', name:'Daniele Citerio', role:'admin', active:true, created:now() }
      ]);
    }
    // Default settings
    if (!load(KEYS.settings)) {
      save(KEYS.settings, {
        company:'La Mia Azienda', currency:'EUR', currencySymbol:'€',
        lowStockAlert:true, backupAuto:false, theme:'dark', language:'it',
        csvDelimiter:',', defaultCategory:'Generale'
      });
    }
    // Demo products
    if (!load(KEYS.products)) {
      const demo = [
        { id:1001, code:'PRD01001', barcode:'8001234567890', name:'Laptop Pro 15"', category:'Informatica', brand:'TechBrand', description:'Laptop professionale 15 pollici', qty:42, qtyMin:10, priceBuy:650, priceSell:999, supplier:'TechSupply Srl', location:'A-01-01', active:true, created:now(), notes:'', image:'' },
        { id:1002, code:'PRD01002', barcode:'8009876543210', name:'Mouse Wireless', category:'Informatica', brand:'LogiMouse', description:'Mouse senza fili ergonomico', qty:7, qtyMin:15, priceBuy:12, priceSell:29, supplier:'TechSupply Srl', location:'A-01-02', active:true, created:now(), notes:'', image:'' },
        { id:1003, code:'PRD01003', barcode:'8005555555555', name:'Tastiera Meccanica', category:'Informatica', brand:'KeyMaster', description:'Tastiera meccanica RGB', qty:23, qtyMin:5, priceBuy:45, priceSell:89, supplier:'ComputerParts Srl', location:'A-02-01', active:true, created:now(), notes:'', image:'' },
        { id:1004, code:'PRD01004', barcode:'8007777777777', name:'Monitor 27" 4K', category:'Informatica', brand:'ViewMax', description:'Monitor UHD 4K HDR', qty:3, qtyMin:5, priceBuy:280, priceSell:499, supplier:'TechSupply Srl', location:'B-01-01', active:true, created:now(), notes:'', image:'' },
        { id:1005, code:'PRD01005', barcode:'8002222222222', name:'Cuffie Bluetooth', category:'Audio', brand:'SoundPro', description:'Cuffie wireless con ANC', qty:18, qtyMin:8, priceBuy:55, priceSell:129, supplier:'AudioStore Srl', location:'C-01-01', active:true, created:now(), notes:'', image:'' },
        { id:1006, code:'PRD01006', barcode:'8003333333333', name:'Webcam Full HD', category:'Informatica', brand:'CamPro', description:'Webcam 1080p con microfono', qty:0, qtyMin:5, priceBuy:28, priceSell:59, supplier:'TechSupply Srl', location:'A-02-02', active:true, created:now(), notes:'Esaurito!', image:'' },
        { id:1007, code:'PRD01007', barcode:'8004444444444', name:'Hub USB-C 7 Porte', category:'Accessori', brand:'HubMax', description:'Hub USB-C con HDMI e lettore SD', qty:31, qtyMin:10, priceBuy:22, priceSell:49, supplier:'ComputerParts Srl', location:'A-03-01', active:true, created:now(), notes:'', image:'' },
        { id:1008, code:'PRD01008', barcode:'8006666666666', name:'SSD Esterno 1TB', category:'Storage', brand:'SpeedDisk', description:'SSD portatile USB-C 1TB', qty:12, qtyMin:6, priceBuy:75, priceSell:149, supplier:'StoragePro Srl', location:'B-02-01', active:true, created:now(), notes:'', image:'' }
      ];
      save(KEYS.products, demo);
      save(KEYS.counters, { PRD:1008, MOV:2000, USR:10 });
      // Demo movements
      const moves = [];
      const now2 = new Date();
      for (let i = 0; i < 20; i++) {
        const d = new Date(now2); d.setDate(d.getDate() - i);
        const type = i % 3 === 0 ? 'out' : 'in';
        const pid = demo[i % demo.length];
        moves.push({
          id: 2001 + i, type, productId: pid.id, productCode: pid.code,
          productName: pid.name, qty: Math.floor(Math.random()*10)+1,
          priceBuy: pid.priceBuy, supplier: type==='in' ? pid.supplier : '',
          customer: type==='out' ? 'Cliente Demo' : '', document: 'DOC-' + (1000+i),
          operator: 'admin', date: d.toISOString().slice(0,10), ts: d.toISOString(), notes:''
        });
      }
      save(KEYS.movements, moves);
    }
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
        p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s) ||
        p.barcode.includes(s) || p.category.toLowerCase().includes(s) ||
        p.brand.toLowerCase().includes(s) || p.supplier.toLowerCase().includes(s)
      );
    },
    create(data) {
      const id = nextId('PRD');
      const p = { id, code: data.code || genCode('PRD'), active:true, created:now(), qty:0, ...data };
      const all = this.all(); all.push(p); save(KEYS.products, all); return p;
    },
    update(id, data) {
      const all = this.all();
      const i = all.findIndex(p => p.id === id);
      if (i<0) return null;
      all[i] = { ...all[i], ...data, id };
      save(KEYS.products, all); return all[i];
    },
    delete(id) {
      const all = this.all().filter(p => p.id !== id);
      save(KEYS.products, all);
    },
    deactivate(id) { return this.update(id, { active:false }); },
    duplicate(id) {
      const p = this.find(id); if (!p) return null;
      return this.create({ ...p, id:undefined, code:undefined, barcode:'', qty:0, created:undefined });
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
    totalValue() { return this.active().reduce((s,p) => s + (p.qty * p.priceBuy), 0); },
    totalQty() { return this.active().reduce((s,p) => s + (p.qty || 0), 0); },
    filter(opts = {}) {
      let arr = this.active();
      if (opts.q) { const s=opts.q.toLowerCase(); arr=arr.filter(p=>p.name.toLowerCase().includes(s)||p.code.toLowerCase().includes(s)||p.barcode?.includes(s)||(p.brand&&p.brand.toLowerCase().includes(s))||(p.model&&p.model.toLowerCase().includes(s))); }
      if (opts.category) arr = arr.filter(p=>p.category===opts.category);
      if (opts.brand) arr = arr.filter(p=>p.brand===opts.brand);
      if (opts.supplier) arr = arr.filter(p=>p.supplier===opts.supplier);
      if (opts.lowStock) arr = arr.filter(p=>p.qty<=p.qtyMin);
      if (opts.outOfStock) arr = arr.filter(p=>p.qty===0);
      return arr;
    }
  };

  // ── MOVEMENTS ──
  const Movements = {
    all() { return load(KEYS.movements) || []; },
    find(id) { return this.all().find(m => m.id === id); },
    create(data) {
      const id = nextId('MOV');
      const m = { id, ts: now(), date: today(), ...data };
      const all = this.all(); all.unshift(m); save(KEYS.movements, all); return m;
    },
    filter(opts = {}) {
      let arr = this.all();
      if (opts.type) arr = arr.filter(m=>m.type===opts.type);
      if (opts.productId) arr = arr.filter(m=>m.productId===opts.productId);
      if (opts.from) arr = arr.filter(m=>m.date>=opts.from);
      if (opts.to) arr = arr.filter(m=>m.date<=opts.to);
      if (opts.q) { const s=opts.q.toLowerCase(); arr=arr.filter(m=>m.productName?.toLowerCase().includes(s)||m.document?.toLowerCase().includes(s)||m.customer?.toLowerCase().includes(s)||m.supplier?.toLowerCase().includes(s)); }
      return arr;
    },
    byProduct() {
      const map = {};
      this.all().forEach(m => {
        if (!map[m.productId]) map[m.productId] = { in:0, out:0, name:m.productName, id:m.productId };
        map[m.productId][m.type] += m.qty;
      });
      return Object.values(map).sort((a,b)=>(b.in+b.out)-(a.in+a.out));
    },
    monthlyStats(months=6) {
      const result = [];
      const now2 = new Date();
      for (let i=months-1; i>=0; i--) {
        const d = new Date(now2.getFullYear(), now2.getMonth()-i, 1);
        const key = d.toISOString().slice(0,7);
        const label = d.toLocaleDateString('it-IT',{month:'short',year:'2-digit'});
        const ins = this.all().filter(m=>m.type==='in'&&m.date?.startsWith(key)).reduce((s,m)=>s+m.qty,0);
        const outs = this.all().filter(m=>m.type==='out'&&m.date?.startsWith(key)).reduce((s,m)=>s+m.qty,0);
        result.push({ label, in:ins, out:outs });
      }
      return result;
    }
  };

  // ── USERS ──
  const Users = {
    all() { return load(KEYS.users) || []; },
    find(id) { return this.all().find(u=>u.id===id); },
    authenticate(username, password) { return this.all().find(u=>u.username===username&&u.password===password&&u.active); },
    create(data) {
      const id = nextId('USR');
      const u = { id, active:true, created:now(), ...data };
      const all = this.all(); all.push(u); save(KEYS.users, all); return u;
    },
    update(id, data) {
      const all = this.all();
      const i = all.findIndex(u=>u.id===id);
      if (i<0) return null;
      all[i] = {...all[i],...data,id};
      save(KEYS.users, all); return all[i];
    },
    delete(id) { save(KEYS.users, this.all().filter(u=>u.id!==id)); },
    ROLES: { admin:'Amministratore', warehouse:'Magazziniere', operator:'Operatore', viewer:'Visualizzatore' },
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
    parse(text, delimiter=',') {
      const lines = text.trim().split('\n');
      if (!lines.length) return { headers:[], rows:[] };
      const headers = lines[0].split(delimiter).map(h=>h.trim().replace(/"/g,'').toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(delimiter).map(v=>v.trim().replace(/"/g,''));
        const obj = {};
        headers.forEach((h,i)=>{ obj[h]=vals[i]||''; });
        return obj;
      }).filter(r=>Object.values(r).some(v=>v));
      return { headers, rows };
    },
    FIELD_MAP: {
      'codice':'code','cod':'code','product_code':'code',
      'barcode':'barcode','ean':'barcode','cod_barre':'barcode',
      'nome':'name','name':'name','prodotto':'name','product':'name',
      'categoria':'category','category':'category','cat':'category',
      'marca':'brand','brand':'brand','marchio':'brand',
      'quantita':'qty','quantity':'qty','qta':'qty','qty':'qty',
      'quantita_minima':'qtyMin','qty_min':'qtyMin','scorta_min':'qtyMin',
      'prezzo_acquisto':'priceBuy','buy_price':'priceBuy','costo':'priceBuy',
      'prezzo_vendita':'priceSell','sell_price':'priceSell','prezzo':'priceSell',
      'fornitore':'supplier','supplier':'supplier',
      'ubicazione':'location','location':'location','posizione':'location',
      'descrizione':'description','description':'description','note':'notes','notes':'notes'
    },
    mapRow(rawRow) {
      const mapped = {};
      Object.entries(rawRow).forEach(([k,v]) => {
        const field = this.FIELD_MAP[k.toLowerCase()];
        if (field) mapped[field] = v;
      });
      return mapped;
    },
    validate(row) {
      const errors = [];
      if (!row.name) errors.push('Nome prodotto mancante');
      if (row.qty !== undefined && isNaN(Number(row.qty))) errors.push('Quantità non valida');
      if (row.priceBuy !== undefined && isNaN(Number(row.priceBuy))) errors.push('Prezzo acquisto non valido');
      if (row.priceSell !== undefined && isNaN(Number(row.priceSell))) errors.push('Prezzo vendita non valido');
      return errors;
    },
    import(rows, operatorName) {
      const results = { created:0, updated:0, errors:[] };
      rows.forEach((rawRow, idx) => {
        const row = this.mapRow(rawRow);
        const errors = this.validate(row);
        if (errors.length) { results.errors.push({ row:idx+2, errors }); return; }
        const numRow = {
          ...row,
          qty: row.qty ? Number(row.qty) : 0,
          qtyMin: row.qtyMin ? Number(row.qtyMin) : 0,
          priceBuy: row.priceBuy ? Number(row.priceBuy) : 0,
          priceSell: row.priceSell ? Number(row.priceSell) : 0
        };
        const existing = row.code ? Products.findByCode(row.code) : null;
        if (existing) { Products.update(existing.id, numRow); results.updated++; }
        else { Products.create(numRow); results.created++; }
      });
      return results;
    },
    template() {
      return 'codice,barcode,nome,categoria,marca,quantita,quantita_minima,prezzo_acquisto,prezzo_vendita,fornitore,ubicazione,descrizione\n' +
             'PRD001,8001234567890,Esempio Prodotto,Categoria,Marca,10,5,10.00,19.99,Fornitore Srl,A-01-01,Descrizione prodotto\n';
    }
  };

  // ── AI & SMART FEATURES ──
  const AI = {
    getInsights() {
      const prods = Products.active();
      const moves = Movements.all();
      const now = new Date();
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString();
      
      const insights = [];
      
      const sales = {};
      moves.filter(m => m.type === 'out' && m.ts >= thirtyDaysAgo).forEach(m => {
        sales[m.productId] = (sales[m.productId] || 0) + m.qty;
      });

      let maxSales = 0;
      let topProd = null;
      prods.forEach(p => {
        const sold = sales[p.id] || 0;
        if (sold > maxSales) { maxSales = sold; topProd = p; }
        
        if (sold > 0 && p.qty > 0 && p.qty <= p.qtyMin * 2) {
          const dailyRate = sold / 30;
          const daysLeft = Math.round(p.qty / dailyRate);
          if (daysLeft > 0 && daysLeft < 15) {
            insights.push({ type: 'warning', icon: '⏳', text: `<b>${p.name}</b> si esaurirà tra circa <b>${daysLeft} giorni</b> al ritmo attuale.` });
          }
        }
      });

      if (topProd && maxSales > 0) {
         insights.push({ type: 'success', icon: '🔥', text: `<b>${topProd.name}</b> è il prodotto del momento (${maxSales} vendite in 30gg).` });
      }

      const ninetyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 90)).toISOString();
      const deadStock = prods.filter(p => p.qty > 0 && !moves.some(m => m.productId === p.id && m.ts >= ninetyDaysAgo));
      if (deadStock.length > 0) {
        insights.push({ type: 'danger', icon: '🧊', text: `Hai <b>${deadStock.length} prodotti</b> fermi da oltre 90 giorni. Valuta una promozione.` });
      }

      return insights;
    },

    ask(query) {
      const q = query.toLowerCase();
      
      if (q.includes('vendut') && q.includes('meno')) {
         const moves = Movements.filter({type:'out'});
         const sales = {};
         Products.active().forEach(p => sales[p.id] = 0);
         moves.forEach(m => { if (sales[m.productId] !== undefined) sales[m.productId] += m.qty; });
         const sorted = Object.keys(sales).map(id => ({name: Products.find(Number(id))?.name, sold: sales[id]})).sort((a,b) => a.sold - b.sold).slice(0, 3);
         let html = `Ecco i prodotti meno venduti:<br><br>`;
         sorted.forEach(p => html += `• <b>${p.name}</b>: ${p.sold} unità<br>`);
         return html;
      }
      
      if (q.includes('profitto') || q.includes('margine')) {
         const cats = Products.categories();
         const cat = cats.find(c => q.includes(c.toLowerCase()));
         let targetProds = Products.active();
         let scope = "tutto il magazzino";
         if (cat) {
            targetProds = targetProds.filter(p => p.category === cat);
            scope = `la categoria <b>${cat}</b>`;
         }
         let totalBuy = 0, totalSell = 0;
         targetProds.forEach(p => {
           if (p.priceBuy > 0 && p.priceSell > 0) {
             totalBuy += (p.priceBuy * p.qty);
             totalSell += (p.priceSell * p.qty);
           }
         });
         if (totalBuy === 0) return `Non ho dati di costo sufficienti per calcolare il margine.`;
         const margin = ((totalSell - totalBuy) / totalSell * 100).toFixed(1);
         return `Il margine di profitto medio (sul valore a stock) per ${scope} è del <b>${margin}%</b>.`;
      }

      if (q.includes('quanti') || q.includes('scorte') || q.includes('disponibil')) {
         const words = q.split(' ');
         const searchWord = words.find(w => w.length > 3 && !['quanti','scorte','sono','della','delle','degli','disponibili'].includes(w));
         if (searchWord) {
            const res = Products.search(searchWord);
            if (res.length > 0) {
               return `Ne abbiamo <b>${res[0].qty}</b> pezzi di <b>${res[0].name}</b> in magazzino.`;
            }
         }
      }

      return "Scusa, non ho capito la domanda. Prova a chiedermi: 'Quali sono i prodotti meno venduti?' oppure 'Mostrami il margine di profitto'.";
    },

    enrichProduct(barcode) {
      return new Promise(resolve => {
        setTimeout(() => {
          const db = [
            { code: '8001', name: 'Olio Essenziale di Lavanda 10ml', category: 'Oli Essenziali', desc: 'Puro olio essenziale estratto a vapore. Proprietà rilassanti.', notes: 'Benefici: Ottimo per ansia, insonnia e per profumare gli ambienti.' },
            { code: '8002', name: 'Tisana Drenante Bio', category: 'Tisane', desc: 'Miscela di erbe officinali biologiche per favorire il drenaggio dei liquidi.', notes: 'Contiene: Betulla, Ortosiphon, Equiseto.' },
            { code: '8003', name: "Crema Viso Antiage all'Argan", category: 'Cosmesi Naturale', desc: 'Crema idratante e rimpolpante per pelli mature.', notes: 'Uso: Applicare mattina e sera su viso e collo puliti.' }
          ];
          const match = db.find(d => barcode.startsWith(d.code)) || {
            name: 'Prodotto Botanico AI (' + barcode + ')',
            category: 'Rimedi Naturali',
            desc: 'Prodotto generato e arricchito tramite AI.',
            notes: 'Verificare le informazioni inserite automaticamente.'
          };
          resolve(match);
        }, 1200);
      });
    }
  };

  // ── BACKUP ──
  const Backup = {
    dailyBackup() {
      const todayStr = today();
      const key = PREFIX + 'backup_daily_' + todayStr;
      if (!localStorage.getItem(key)) {
        const data = {
          version:'1.0', exported:now(),
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
        version:'1.0', exported:now(),
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
        version:'1.0', exported:now(),
        products: Products.all(),
        movements: Movements.all(),
        users: Users.all(),
        settings: Settings.get()
      };
      const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
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

  // Helper to trigger backup after mutation
  function mutate(fn) {
    return function(...args) {
      const res = fn.apply(this, args);
      Backup.autoBackup();
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
  return { Products, Movements, Users, Settings, CSV, Backup, AI };
})();
