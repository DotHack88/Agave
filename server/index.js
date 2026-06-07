// -------------------------------------------------
//  Express server – endpoint /backup
// -------------------------------------------------
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;   // Accedi con http://localhost:3000

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve i file statici dalla root del progetto
app.use(express.static(path.join(__dirname, '..')));

// ---------- Data persistence ----------
const DATA_FILE = path.join(__dirname, '..', 'data.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { products: [], movements: [], users: [], settings: {}, counters: {} };
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return { products: [], movements: [], users: [], settings: {}, counters: {} }; }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function ensureDemoData() {
  const data = loadData();
  // If empty, seed with demo data (same as client init)
  if (!data.products || data.products.length === 0) {
    const demo = [
      { id: 1001, code: 'PRD01001', barcode: '8001234567890', name: 'Laptop Pro 15"', category: 'Informatica', brand: 'TechBrand', description: 'Laptop professionale 15 pollici', qty: 42, qtyMin: 10, priceBuy: 650, priceSell: 999, supplier: 'TechSupply Srl', location: 'A-01-01', active: true, created: new Date().toISOString(), notes: '', image: '' },
      { id: 1002, code: 'PRD01002', barcode: '8009876543210', name: 'Mouse Wireless', category: 'Informatica', brand: 'LogiMouse', description: 'Mouse senza fili ergonomico', qty: 7, qtyMin: 15, priceBuy: 12, priceSell: 29, supplier: 'TechSupply Srl', location: 'A-01-02', active: true, created: new Date().toISOString(), notes: '', image: '' },
      { id: 1003, code: 'PRD01003', barcode: '8005555555555', name: 'Tastiera Meccanica', category: 'Informatica', brand: 'KeyMaster', description: 'Tastiera meccanica RGB', qty: 23, qtyMin: 5, priceBuy: 45, priceSell: 89, supplier: 'ComputerParts Srl', location: 'A-02-01', active: true, created: new Date().toISOString(), notes: '', image: '' }
    ];
    data.products = demo;
    data.counters = { PRD: 1008, MOV: 2000, USR: 10 };
    // Demo movements
    const moves = [];
    const now = new Date();
    for (let i = 0; i < 20; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const type = i % 3 === 0 ? 'out' : 'in';
      const pid = demo[i % demo.length];
      moves.push({
        id: 2001 + i,
        type,
        productId: pid.id,
        productCode: pid.code,
        productName: pid.name,
        qty: Math.floor(Math.random() * 10) + 1,
        priceBuy: pid.priceBuy,
        supplier: type === 'in' ? pid.supplier : '',
        customer: type === 'out' ? 'Cliente Demo' : '',
        document: 'DOC-' + (1000 + i),
        operator: 'admin',
        date: d.toISOString().slice(0, 10),
        ts: d.toISOString(),
        notes: ''
      });
    }
    data.movements = moves;
    // Default users
    data.users = [
      { id: 1, username: 'admin', password: 'admin', name: 'Amministratore', role: 'admin', active: true, created: new Date().toISOString() },
      { id: 2, username: 'magazziniere', password: '1234', name: 'Mario Rossi', role: 'warehouse', active: true, created: new Date().toISOString() },
      { id: 3, username: 'operatore', password: '1234', name: 'Luca Bianchi', role: 'operator', active: true, created: new Date().toISOString() },
      { id: 4, username: 'Daniele', password: 'Citerio', name: 'Daniele Citerio', role: 'admin', active: true, created: new Date().toISOString() }
    ];
    // Default settings
    data.settings = {
      company: 'La Mia Azienda', currency: 'EUR', currencySymbol: '€', lowStockAlert: true, backupAuto: false, theme: 'dark', language: 'it', csvDelimiter: ',', defaultCategory: 'Generale'
    };
    saveData(data);
  }
}
ensureDemoData();

// ---------- Helper functions ----------
const PREFIX = 'agavewms_';
function nextId(entity) {
  const counters = loadData().counters || {};
  counters[entity] = (counters[entity] || 1000) + 1;
  const data = loadData();
  data.counters = counters;
  saveData(data);
  return counters[entity];
}
function genCode(prefix) {
  return prefix + String(nextId(prefix)).padStart(5, '0');
}
function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }

// ---------- API Endpoints ----------
app.get('/api/initialize', (req, res) => {
  const data = loadData();
  res.json({ products: data.products, movements: data.movements, users: data.users, settings: data.settings, counters: data.counters });
});

// Bulk import: sovrascrive il db.json con i dati inviati dal client (per migrazione iniziale)
app.post('/api/bulk-import', (req, res) => {
  const { products, movements, users, settings, counters } = req.body;
  const data = loadData();
  if (Array.isArray(products) && products.length > 0) data.products = products;
  if (Array.isArray(movements) && movements.length > 0) data.movements = movements;
  if (Array.isArray(users) && users.length > 0) data.users = users;
  if (settings && typeof settings === 'object') data.settings = { ...data.settings, ...settings };
  if (counters && typeof counters === 'object') data.counters = { ...data.counters, ...counters };
  saveData(data);
  console.log('[AgaveWMS] Bulk import: ' + (products || []).length + ' prodotti, ' + (movements || []).length + ' movimenti.');
  res.json({ success: true, products: (data.products || []).length });
});

// Products
app.get('/api/products', (req, res) => {
  const data = loadData();
  res.json(data.products || []);
});
app.get('/api/products/:id', (req, res) => {
  const data = loadData();
  const prod = (data.products || []).find(p => p.id === Number(req.params.id));
  if (!prod) return res.status(404).json({ error: 'Product not found' });
  res.json(prod);
});
app.post('/api/products', (req, res) => {
  const data = loadData();
  const id = nextId('PRD');
  const product = { id, code: req.body.code || genCode('PRD'), created: now(), active: true, ...req.body };
  data.products = data.products || [];
  data.products.push(product);
  // record initial movement if qty > 0
  if (product.qty && product.qty > 0) {
    const move = {
      id: nextId('MOV'),
      type: 'in',
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      qty: product.qty,
      brand: product.brand || '',
      model: product.model || '',
      operator: req.body.operator || 'admin',
      notes: 'Carico iniziale da creazione prodotto',
      date: today(),
      ts: now()
    };
    data.movements = data.movements || [];
    data.movements.unshift(move);
  }
  saveData(data);
  res.json(product);
});
app.put('/api/products/:id', (req, res) => {
  const data = loadData();
  const idx = (data.products || []).findIndex(p => p.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Product not found' });
  const oldProd = data.products[idx];
  const updated = { ...oldProd, ...req.body, id: oldProd.id };
  data.products[idx] = updated;
  // qty delta movement
  const delta = (updated.qty || 0) - (oldProd.qty || 0);
  if (delta !== 0) {
    const move = {
      id: nextId('MOV'),
      type: delta > 0 ? 'in' : 'out',
      productId: updated.id,
      productCode: updated.code,
      productName: updated.name,
      qty: Math.abs(delta),
      brand: updated.brand || '',
      model: updated.model || '',
      operator: req.body.operator || 'admin',
      notes: delta > 0 ? 'Carico da modifica prodotto' : 'Scarico da modifica prodotto',
      date: today(),
      ts: now()
    };
    data.movements = data.movements || [];
    data.movements.unshift(move);
  }
  saveData(data);
  res.json(updated);
});
app.delete('/api/products/:id', (req, res) => {
  const data = loadData();
  const before = (data.products || []).filter(p => p.id !== Number(req.params.id));
  data.products = before;
  saveData(data);
  res.json({ success: true });
});

// Movements
app.get('/api/movements', (req, res) => {
  const data = loadData();
  res.json(data.movements || []);
});
app.post('/api/movements', (req, res) => {
  const data = loadData();
  const movement = { id: nextId('MOV'), ts: now(), date: today(), ...req.body };
  data.movements = data.movements || [];
  data.movements.unshift(movement);
  saveData(data);
  res.json(movement);
});

// Users
app.get('/api/users', (req, res) => {
  const data = loadData();
  res.json(data.users || []);
});
app.post('/api/users', (req, res) => {
  const data = loadData();
  const id = nextId('USR');
  const user = { id, active: true, created: now(), ...req.body };
  data.users = data.users || [];
  data.users.push(user);
  saveData(data);
  res.json(user);
});
app.put('/api/users/:id', (req, res) => {
  const data = loadData();
  const idx = (data.users || []).findIndex(u => u.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'User not found' });
  const updated = { ...data.users[idx], ...req.body, id: data.users[idx].id };
  data.users[idx] = updated;
  saveData(data);
  res.json(updated);
});
app.delete('/api/users/:id', (req, res) => {
  const data = loadData();
  data.users = (data.users || []).filter(u => u.id !== Number(req.params.id));
  saveData(data);
  res.json({ success: true });
});

// Settings
app.get('/api/settings', (req, res) => {
  const data = loadData();
  res.json(data.settings || {});
});
app.post('/api/settings', (req, res) => {
  const data = loadData();
  data.settings = { ...(data.settings || {}), ...req.body };
  saveData(data);
  res.json(data.settings);
});

// ------------------- POST /backup -------------------
// body: { destFolder: "nomeCartellaSceltaDallUtente" }
app.post('/backup', (req, res) => {
    const destFolder = req.body.destFolder?.trim();
    if (!destFolder) {
        return res.status(400).json({ error: 'destFolder è obbligatorio' });
    }

    // Cartella temporanea per il backup (unica per questa richiesta)
    const tempRoot = path.join(__dirname, '..', 'backup_temp');
    if (!fs.existsSync(tempRoot)) fs.mkdirSync(tempRoot, { recursive: true });

    // 1️⃣ Esegui backup.ps1 passando la cartella temporanea
    const backupScript = path.join(__dirname, '..', 'backup.ps1');
    execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', backupScript,
        '-dest', tempRoot
    ], (err, stdout, stderr) => {
        if (err) {
            console.error('Errore backup.ps1:', stderr);
            return res.status(500).json({ error: 'Backup fallito' });
        }
        console.log(stdout);

        // 2️⃣ Trova la cartella creata (contiene il timestamp)
        const subfolders = fs.readdirSync(tempRoot)
            .filter(name => fs.lstatSync(path.join(tempRoot, name)).isDirectory());

        if (subfolders.length === 0) {
            return res.status(500).json({ error: 'Nessuna cartella di backup trovata' });
        }
        const backupPath = path.join(tempRoot, subfolders[0]); // unica cartella creata

        // 3️⃣ Crea lo ZIP con zipFolder.ps1
        const zipPath = path.join(tempRoot, 'backup.zip');
        const zipScript = path.join(__dirname, 'utils', 'zipFolder.ps1');
        execFile('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', zipScript,
            '-FolderPath', backupPath,
            '-ZipPath', zipPath
        ], (zipErr, zipOut, zipErrOut) => {
            if (zipErr) {
                console.error('Errore zipFolder.ps1:', zipErrOut);
                return res.status(500).json({ error: 'Creazione ZIP fallita' });
            }
            console.log(zipOut);

            // 4️⃣ Invia il file ZIP al client
            res.download(zipPath, 'backup.zip', dlErr => {
                // Pulizia della cartella temporanea
                fs.rmSync(tempRoot, { recursive: true, force: true });
                if (dlErr) console.error('Errore download:', dlErr);
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server attivo su http://localhost:${PORT}`);
});
