import re

# 1. Update js/sections.js
with open('js/sections.js', 'r', encoding='utf-8') as f:
    sections_content = f.read()

# Pattern for saveProduct
sections_pattern = r'''(const oldProd = DB\.Products\.find\(id\);
\s*const oldQty = oldProd \? \(oldProd\.qty \|\| 0\) : 0;
\s*)(DB\.Products\.update\(id, data\);
\s*const delta = \(data\.qty \|\| 0\) - oldQty;)'''

sections_replacement = r'''\1const oldQtyMin = oldProd ? (oldProd.qtyMin || 0) : 0;
      const delta = (data.qty || 0) - oldQty;
      if (delta === 0) delete data.qty;
      if (data.qtyMin === oldQtyMin) delete data.qtyMin;
      \2'''

new_sections = re.sub(sections_pattern, sections_replacement, sections_content)
with open('js/sections.js', 'w', encoding='utf-8') as f:
    f.write(new_sections)

# 2. Update js/db.js
with open('js/db.js', 'r', encoding='utf-8') as f:
    db_content = f.read()

pushToServer_pattern = r'''  // Push al server — solo in produzione \(Firebase\)
  async function pushToServer\(\) \{
    if \(_isLocalhost\) return; // ← su localhost non toccare Firebase
    if \(_syncInProgress\) \{ _syncPending = true; return; \}
    _syncInProgress = true;
    _syncPending = false;
    try \{
      await fetch\(FIREBASE_URL \+ '/data\.json', \{
        method: 'PUT',
        headers: \{ 'Content-Type': 'application/json' \},
        body: JSON\.stringify\(\{
          initialized: true,
          products:  load\(KEYS\.products\)  \|\| \[\],
          movements: load\(KEYS\.movements\) \|\| \[\],
          users:     load\(KEYS\.users\)     \|\| \[\],
          settings:  load\(KEYS\.settings\)  \|\| \{\},
          counters:  load\(KEYS\.counters\)  \|\| \{\}
        \}\)
      \}\);
    \} catch \(e\) \{
      console\.warn\('\[AgaveWMS\] Push Firebase fallito:', e\.message\);
    \} finally \{
      _syncInProgress = false;
      if \(_syncPending\) pushToServer\(\);
    \}
  \}'''

pushToServer_replacement = '''  // Push al server — solo in produzione (Firebase)
  async function pushToServer() {
    if (_isLocalhost) return; // ← su localhost non toccare Firebase
    if (_syncInProgress) { _syncPending = true; return; }
    _syncInProgress = true;
    _syncPending = false;
    try {
      const txLog = load(PREFIX + 'tx_log') || [];
      if (txLog.length === 0) {
        _syncInProgress = false;
        return;
      }
      
      const res = await fetch(FIREBASE_URL + '/data.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const serverData = (await res.json()) || {};
      
      if (!serverData.initialized) {
        await fetch(FIREBASE_URL + '/data.json', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initialized: true,
            products: load(KEYS.products) || [],
            movements: load(KEYS.movements) || [],
            users: load(KEYS.users) || [],
            settings: load(KEYS.settings) || {},
            counters: load(KEYS.counters) || {}
          })
        });
        save(PREFIX + 'tx_log', []);
        _syncInProgress = false;
        if (_syncPending) pushToServer();
        return;
      }
      
      serverData.products = serverData.products || [];
      serverData.movements = serverData.movements || [];
      serverData.users = serverData.users || [];
      serverData.settings = serverData.settings || {};
      serverData.counters = { ...(serverData.counters || {}), ...(load(KEYS.counters) || {}) };
      
      for (const tx of txLog) {
         if (tx.entity === 'Products') {
            if (tx.action === 'create') {
               if (!serverData.products.find(p => p.id === tx.res.id)) serverData.products.push(tx.res);
            } else if (tx.action === 'update') {
               const p = serverData.products.find(x => x.id === tx.args[0]);
               if (p) Object.assign(p, tx.args[1]);
            } else if (tx.action === 'delete') {
               serverData.products = serverData.products.filter(x => x.id !== tx.args[0]);
            } else if (tx.action === 'updateQty') {
               const p = serverData.products.find(x => x.id === tx.args[0]);
               if (p) p.qty = Math.max(0, (p.qty || 0) + tx.args[1]);
            }
         } else if (tx.entity === 'Movements') {
            if (tx.action === 'create') {
               if (!serverData.movements.find(m => m.id === tx.res.id)) serverData.movements.unshift(tx.res);
            }
         } else if (tx.entity === 'Users') {
            if (tx.action === 'create') {
               if (!serverData.users.find(u => u.id === tx.res.id)) serverData.users.push(tx.res);
            } else if (tx.action === 'update') {
               const u = serverData.users.find(x => String(x.id) === String(tx.args[0]));
               if (u) Object.assign(u, tx.args[1]);
            } else if (tx.action === 'delete') {
               serverData.users = serverData.users.filter(x => String(x.id) !== String(tx.args[0]));
            }
         } else if (tx.entity === 'Settings') {
            if (tx.action === 'set') {
               Object.assign(serverData.settings, tx.args[0]);
            }
         } else if (tx.entity === 'System') {
            if (tx.action === 'bulk') {
               serverData.products = tx.args[0].products;
               serverData.movements = tx.args[0].movements;
            }
         }
      }
      
      const putRes = await fetch(FIREBASE_URL + '/data.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      });
      if (!putRes.ok) throw new Error('PUT HTTP ' + putRes.status);
      
      save(PREFIX + 'tx_log', []);
      save(KEYS.products, serverData.products);
      save(KEYS.movements, serverData.movements);
      save(KEYS.users, serverData.users);
      save(KEYS.settings, serverData.settings);
      save(KEYS.counters, serverData.counters);
      
      if (typeof App !== 'undefined' && App.getUser && App.getUser()) {
        const section = document.querySelector('.nav-item.active')?.dataset?.section;
        if (section && typeof Sections !== 'undefined') {
          try { Sections.render(section); } catch(e) {}
        }
      }
    } catch (e) {
      console.warn('[AgaveWMS] Push Firebase fallito:', e.message);
    } finally {
      _syncInProgress = false;
      if (_syncPending) pushToServer();
    }
  }'''
db_content = re.sub(pushToServer_pattern, pushToServer_replacement, db_content)

polling_pattern = r'''  // Polling ogni 30s — solo in produzione \(Firebase\)
  setInterval\(async \(\) => \{
    if \(_isLocalhost\) return; // ← su localhost nessun polling Firebase
    if \(_syncInProgress\) return;
    try \{
      const res = await fetch\(FIREBASE_URL \+ '/data\.json'\);'''

polling_replacement = '''  // Polling ogni 30s — solo in produzione (Firebase)
  setInterval(async () => {
    if (_isLocalhost) return; // ← su localhost nessun polling Firebase
    if (_syncInProgress) return;
    
    const txLog = load(PREFIX + 'tx_log') || [];
    if (txLog.length > 0) {
      pushToServer();
      return;
    }

    try {
      const res = await fetch(FIREBASE_URL + '/data.json');'''
db_content = re.sub(polling_pattern, polling_replacement, db_content)

csv_pattern = r'''      // ✅ Push: Firebase in produzione, data\.json su localhost
      pushToServer\(\);       // → Firebase \(no-op su localhost\)
      pushToLocalServer\(\);  // → data\.json \(no-op in produzione\)'''

csv_replacement = '''      // ✅ Push: Firebase in produzione, data.json su localhost
      const tx = load(PREFIX + 'tx_log') || [];
      tx.push({ entity: 'System', action: 'bulk', args: [{ products: allProducts, movements: allMovements }], ts: Date.now() });
      save(PREFIX + 'tx_log', tx);
      pushToServer();       // → Firebase (no-op su localhost)
      pushToLocalServer();  // → data.json (no-op in produzione)'''
db_content = re.sub(csv_pattern, csv_replacement, db_content)

mutate_pattern = r'''  // Helper to trigger backup \+ server push after mutation
  function mutate\(fn\) \{
    return function \(\.\.\.args\) \{
      const res = fn\.apply\(this, args\);
      Backup\.autoBackup\(\);
      pushToServer\(\);        // → Firebase \(solo in produzione, no-op su localhost\)
      pushToLocalServer\(\);   // → data\.json \(solo su localhost, no-op in produzione\)
      return res;
    \};
  \}

  // Wrap mutations
  Products\.create    = mutate\(Products\.create\);
  Products\.update    = mutate\(Products\.update\);
  Products\.delete    = mutate\(Products\.delete\);
  Products\.updateQty = mutate\(Products\.updateQty\);
  Movements\.create   = mutate\(Movements\.create\);
  Users\.create       = mutate\(Users\.create\);
  Users\.update       = mutate\(Users\.update\);
  Users\.delete       = mutate\(Users\.delete\);'''

mutate_replacement = '''  // Helper to trigger backup + server push after mutation
  function mutate(fn, entity, action) {
    return function (...args) {
      const res = fn.apply(this, args);
      
      if (entity && action && !_isLocalhost) {
         const tx = load(PREFIX + 'tx_log') || [];
         tx.push({ entity, action, args, res, ts: Date.now() });
         save(PREFIX + 'tx_log', tx);
      }
      
      Backup.autoBackup();
      pushToServer();        // → Firebase (solo in produzione, no-op su localhost)
      pushToLocalServer();   // → data.json (solo su localhost, no-op in produzione)
      return res;
    };
  }

  // Wrap mutations
  Products.create    = mutate(Products.create, 'Products', 'create');
  Products.update    = mutate(Products.update, 'Products', 'update');
  Products.delete    = mutate(Products.delete, 'Products', 'delete');
  Products.updateQty = mutate(Products.updateQty, 'Products', 'updateQty');
  Movements.create   = mutate(Movements.create, 'Movements', 'create');
  Users.create       = mutate(Users.create, 'Users', 'create');
  Users.update       = mutate(Users.update, 'Users', 'update');
  Users.delete       = mutate(Users.delete, 'Users', 'delete');
  Settings.set       = mutate(Settings.set, 'Settings', 'set');'''
db_content = re.sub(mutate_pattern, mutate_replacement, db_content)


with open('js/db.js', 'w', encoding='utf-8') as f:
    f.write(db_content)

print("Patching complete")
