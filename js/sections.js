/* ============================
   AgaveWMS – Sections Renderer
   Part 1: Dashboard & Products
   ============================ */
const Sections = (() => {
  // ── RENDER ROUTER ──
  function render(section) {
    const map = { dashboard:'renderDashboard', products:'renderProducts', inbound:'renderInbound',
      outbound:'renderOutbound', movements:'renderMovements', csv:'renderCSV', reports:'renderReports', settings:'renderSettings' };
    const fn = map[section];
    if (fn && typeof Sections[fn] === 'function') Sections[fn]();
  }

  // ── DASHBOARD ──
  function renderDashboard() {
    const el = document.getElementById('section-dashboard');
    const prods = DB.Products.active();
    const low = DB.Products.lowStock();
    const moves = DB.Movements.all().slice(0,8);

    el.innerHTML = `
<div class="page-header"><h1>Dashboard</h1>
  <div class="actions">
    <button class="btn btn-primary" onclick="App.navigate('products');Sections.openProductForm()">➕ Nuovo Prodotto</button>
  </div>
</div>

<div class="grid-2">
  <div class="card">
    <div class="card-header"><span class="card-title">🕐 Ultimi movimenti</span><button class="btn btn-ghost btn-sm" onclick="App.navigate('movements')">Tutti →</button></div>
    <div class="recent-list">${moves.map(m=>`
      <div class="recent-item">
        <div class="ri-dot ${m.type}"></div>
        <div class="ri-info">
          <div class="ri-name">${App.escape(m.productName)}</div>
          <div class="ri-meta">${App.fmtDate(m.date)} • ${m.operator}</div>
        </div>
        <div class="ri-qty ${m.type}">${m.type==='in'?'+':'-'}${m.qty}</div>
      </div>`).join('')||'<div class="empty-state" style="padding:20px"><p>Nessun movimento</p></div>'}</div>
  </div>

  <div class="card">
    <div class="card-header">
      <span class="card-title">📦 Scorte ${low.length ? `<span class="badge badge-red" style="margin-left:8px">${low.length}</span>` : ''}</span>
      <button class="btn btn-ghost btn-sm" onclick="App.navigate('products');Sections.toggleLowStockFilter()">Vedi tutti →</button>
    </div>
    <div class="recent-list">${low.length ? low.map(p => {
      const stockPct = p.qtyMin > 0 ? Math.min(100, Math.round((p.qty / p.qtyMin) * 100)) : 100;
      const stockClass = p.qty === 0 ? 'critical' : 'low';
      const badge = p.qty === 0 ? 'badge-red' : 'badge-yellow';
      return `
      <div class="recent-item">
        <div class="ri-dot" style="background:var(${p.qty === 0 ? '--red' : '--yellow'})"></div>
        <div class="ri-info">
          <div class="ri-name">${App.escape(p.name)}</div>
          <div class="ri-meta">${p.code || '—'} • Min: ${p.qtyMin}</div>
          <div class="stock-bar" style="margin-top:4px;max-width:120px">
            <div class="stock-bar-track"><div class="stock-bar-fill ${stockClass}" style="width:${stockPct}%"></div></div>
          </div>
        </div>
        <span class="badge ${badge}" style="margin-right:6px">${p.qty}</span>
        <div class="td-actions">
          <button class="btn btn-success btn-sm" onclick="App.navigate('inbound');Sections.prefillInbound(${p.id})" title="Carica">+</button>
          <button class="btn btn-danger btn-sm" onclick="App.navigate('outbound');Sections.prefillOutbound(${p.id})" title="Scarica">-</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state" style="padding:20px"><div class="es-icon">✅</div><p>Tutti i prodotti sono sopra la scorta minima</p></div>'}</div>
  </div>
</div>`;
  }

  // ── PRODUCTS ──
  let prodFilters = { q:'', lowStock:false, sortKey:'name', sortOrder:'asc' };

  function getSortArrow(key) {
    if (prodFilters.sortKey !== key) return '<span style="color:var(--text3);font-size:.7rem">⇅</span>';
    return prodFilters.sortOrder === 'asc' ? '▲' : '▼';
  }

  function toggleProdSort(key) {
    if (prodFilters.sortKey === key) {
      prodFilters.sortOrder = prodFilters.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      prodFilters.sortKey = key;
      prodFilters.sortOrder = 'asc';
    }
    renderProducts();
  }

  function renderProducts() {
    const el = document.getElementById('section-products');
    const prods = DB.Products.filter(prodFilters);

    // Apply sorting
    if (prodFilters.sortKey) {
      prods.sort((a, b) => {
        let valA = a[prodFilters.sortKey];
        let valB = b[prodFilters.sortKey];
        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = (valB || '').toLowerCase();
          return prodFilters.sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          valA = valA || 0;
          valB = valB || 0;
          return prodFilters.sortOrder === 'asc' ? valA - valB : valB - valA;
        }
      });
    }

    const canEdit = DB.Users.canEdit(App.getUser());
    const canDel = DB.Users.canDelete(App.getUser());

    const hasStructure = el.querySelector('.filters-bar') !== null;
    if (!hasStructure) {
      el.innerHTML = `
<div class="page-header">
  <h1>Prodotti <span id="prod-count-badge" style="color:var(--text2);font-size:1rem;font-weight:400">(${prods.length})</span></h1>
  <div class="actions">
    ${canEdit?`<button class="btn btn-primary" onclick="Sections.openProductForm()">
      ➕ Nuovo Prodotto</button>`:''}
          <button class="btn btn-ghost" onclick="Sections.exportProducts()">⬇ Esporta</button>
     <button class="btn btn-ghost btn-sm" onclick="SectionsCSV.openImportModal()">📂 Importa CSV</button>
      <button class="btn btn-ghost btn-sm" onclick="SectionsCSV.openImportModal()">📂 Importa CSV</button>
  </div>
</div>
<div class="filters-bar">
  <input type="text" id="prod-filter-q" placeholder="🔍 Cerca per nome, codice, barcode, marca o modello..." value="${prodFilters.q}"
    oninput="Sections.setProdFilter('q',this.value)" style="flex:1;min-width:200px"/>
  <button id="prod-filter-lowStock-btn" class="btn ${prodFilters.lowStock ? 'btn-warning' : 'btn-ghost'} btn-sm" onclick="Sections.toggleLowStockFilter()">⚠️ Sotto Scorta</button>
  <button class="btn btn-ghost btn-sm" onclick="Sections.resetProdFilters()">Reset</button>
</div>
<div class="table-wrap">
<table id="products-table">
<thead>
  <tr>
    <th style="cursor:pointer" onclick="Sections.toggleProdSort('code')">Codice ${getSortArrow('code')}</th>
    <th style="cursor:pointer" onclick="Sections.toggleProdSort('name')">Prodotto ${getSortArrow('name')}</th>
    <th style="cursor:pointer" onclick="Sections.toggleProdSort('brand')">Marca ${getSortArrow('brand')}</th>
    <th style="cursor:pointer" onclick="Sections.toggleProdSort('model')">Modello ${getSortArrow('model')}</th>
    <th style="cursor:pointer" onclick="Sections.toggleProdSort('qty')">Giacenza ${getSortArrow('qty')}</th>
    <th style="cursor:pointer" onclick="Sections.toggleProdSort('qtyMin')">Scorta min. ${getSortArrow('qtyMin')}</th>
    <th>Azioni</th>
  </tr>
</thead>
<tbody id="products-tbody"></tbody>
</table>
</div>`;
    } else {
      // Update headers in-place to keep sorting arrow correct without input focus loss
      const headers = el.querySelectorAll('thead th');
      if (headers.length >= 6) {
        headers[0].innerHTML = `Codice ${getSortArrow('code')}`;
        headers[1].innerHTML = `Prodotto ${getSortArrow('name')}`;
        headers[2].innerHTML = `Marca ${getSortArrow('brand')}`;
        headers[3].innerHTML = `Modello ${getSortArrow('model')}`;
        headers[4].innerHTML = `Giacenza ${getSortArrow('qty')}`;
        headers[5].innerHTML = `Scorta min. ${getSortArrow('qtyMin')}`;
      }
    }

    const tbody = document.getElementById('products-tbody');
    const countBadge = document.getElementById('prod-count-badge');
    if (countBadge) countBadge.textContent = `(${prods.length})`;

    if (tbody) {
      tbody.innerHTML = prods.length ? prods.map(p => {
        const stockPct = p.qtyMin > 0 ? Math.min(100, Math.round((p.qty/p.qtyMin)*100)) : 100;
        const stockClass = p.qty === 0 ? 'critical' : p.qty <= p.qtyMin ? 'low' : 'ok';
        const badge = p.qty === 0 ? 'badge-red' : p.qty <= p.qtyMin ? 'badge-yellow' : 'badge-green';
        return `<tr>
          <td><div class="td-code">${p.code}</div>${p.barcode?`<div class="td-code" style="font-size:.7rem;color:var(--text3)">${p.barcode}</div>`:''}</td>
          <td style="font-weight:600;max-width:240px">${App.escape(p.name)}</td>
          <td>${App.escape(p.brand||'—')}</td>
          <td>${App.escape(p.model||'—')}</td>
          <td>
            <span class="badge ${badge}">${p.qty}</span>
            <div class="stock-bar" style="margin-top:4px;min-width:60px"><div class="stock-bar-track"><div class="stock-bar-fill ${stockClass}" style="width:${stockPct}%"></div></div></div>
          </td>
          <td>${p.qtyMin}</td>
          <td><div class="td-actions">
            ${canEdit?`<button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.editProduct(${p.id})" title="Modifica">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.duplicateProduct(${p.id})" title="Duplica">📋</button>`:'' }
            ${canDel?`<button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.deleteProduct(${p.id})" title="Elimina">🗑️</button>`:''}
            <button class="btn btn-success btn-sm" onclick="App.navigate('inbound');Sections.prefillInbound(${p.id})">+</button>
            <button class="btn btn-danger" onclick="App.navigate('outbound');Sections.prefillOutbound(${p.id})">-</button>
          </div></td>
        </tr>`;
      }).join('') : '<tr><td colspan="7"><div class="empty-state"><div class="es-icon">📦</div><h3>Nessun prodotto trovato</h3><p>Prova a modificare i filtri o aggiungine uno nuovo</p></div></td></tr>';
    }
  }

  function setProdFilter(key, val) {
    prodFilters[key] = val;
    renderProducts();
  }

  function toggleLowStockFilter() {
    prodFilters.lowStock = !prodFilters.lowStock;
    const btn = document.getElementById('prod-filter-lowStock-btn');
    if (btn) {
      if (prodFilters.lowStock) {
        btn.classList.remove('btn-ghost');
        btn.classList.add('btn-warning');
      } else {
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-ghost');
      }
    }
    renderProducts();
  }

  function resetProdFilters() {
    prodFilters = { q:'', lowStock:false, sortKey:'name', sortOrder:'asc' };
    const el = document.getElementById('section-products');
    if (el) el.innerHTML = ''; // Rebuild layout
    renderProducts();
  }

  function productFormHTML(p = {}) {
    const brands = DB.Products.brands();
    const brandOptions = brands.map(b => `<option value="${App.escape(b)}"></option>`).join('');
    return `<div class="form-grid">
      <div class="form-group"><label>Barcode / EAN</label><input id="pf-barcode" value="${App.escape(p.barcode||'')}" placeholder="8001234567890"/></div>
      <div class="form-group span-2"><label>Nome Prodotto *</label><input id="pf-name" value="${App.escape(p.name||'')}" placeholder="Nome del prodotto"/></div>
      <div class="form-group">
        <label>Marca</label>
        <input id="pf-brand" value="${App.escape(p.brand||'')}" placeholder="Marca" list="brand-suggestions" autocomplete="off"/>
        <datalist id="brand-suggestions">
          ${brandOptions}
        </datalist>
      </div>
      <div class="form-group"><label>Modello</label><input id="pf-model" value="${App.escape(p.model||'')}" placeholder="Modello"/></div>
      <div class="form-group"><label>Quantità disponibile</label><input id="pf-qty" type="number" min="0" value="${p.qty||0}"/></div>
      <div class="form-group"><label>Quantità minima (scorta)</label><input id="pf-qtyMin" type="number" min="0" value="${p.qtyMin||0}"/></div>
      <div class="form-group span-2"><label>Descrizione</label><textarea id="pf-desc" placeholder="Descrizione prodotto">${App.escape(p.description||'')}</textarea></div>
    </div>`;
  }

  function getProductFormData() {
    return {
      barcode: document.getElementById('pf-barcode').value.trim(),
      name: document.getElementById('pf-name').value.trim(),
      brand: document.getElementById('pf-brand').value.trim(),
      model: document.getElementById('pf-model').value.trim(),
      qty: Number(document.getElementById('pf-qty').value) || 0,
      qtyMin: Number(document.getElementById('pf-qtyMin').value) || 0,
      description: document.getElementById('pf-desc').value.trim()
    };
  }

  function openProductForm(pre = {}) {
    App.openModal('Nuovo Prodotto', productFormHTML(pre),
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
       <button class="btn btn-primary" onclick="Sections.saveProduct()">💾 Salva Prodotto</button>`, true);
  }

  function editProduct(id) {
    const p = DB.Products.find(id);
    if (!p) return;
    App.openModal('Modifica Prodotto', productFormHTML(p),
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
       <button class="btn btn-primary" onclick="Sections.saveProduct(${id})">💾 Aggiorna</button>`, true);
  }

  function saveProduct(id) {
    const data = getProductFormData();
    if (!data.name) { App.toast('Il nome prodotto è obbligatorio','error'); return; }
    if (id) { DB.Products.update(id, data); App.toast('Prodotto aggiornato','success'); }
    else { DB.Products.create(data); App.toast('Prodotto creato','success'); }
    App.closeModal(); App.updateNotifications();
    const el = document.getElementById('section-products');
    if (el) el.innerHTML = ''; // Rebuild layout
    renderProducts();
  }

  function duplicateProduct(id) {
    const p = DB.Products.duplicate(id);
    App.toast(`Prodotto "${p.name}" duplicato`,'info');
    const el = document.getElementById('section-products');
    if (el) el.innerHTML = '';
    renderProducts();
  }

  function deleteProduct(id) {
    const p = DB.Products.find(id);
    App.confirm(`Eliminare il prodotto "${p?.name}"? L'operazione non è reversibile.`, () => {
      DB.Products.delete(id); App.toast('Prodotto eliminato','warning'); App.updateNotifications();
      const el = document.getElementById('section-products');
      if (el) el.innerHTML = '';
      renderProducts();
    });
  }

  function exportProducts() {
    const prods = DB.Products.filter(prodFilters);
    const headers = ['barcode','nome','marca','modello','quantita','quantita_minima','descrizione'];
    const rows = prods.map(p=>[p.barcode,p.name,p.brand,p.model,p.qty,p.qtyMin,p.description].map(v=>`"${v||''}"`).join(','));
    const csv = [headers.join(','),...rows].join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `prodotti_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    App.toast('Esportazione completata','success');
  }

  return { render, renderDashboard, renderProducts, setProdFilter, resetProdFilters,
    openProductForm, editProduct, saveProduct, duplicateProduct, deleteProduct, exportProducts,
    toggleProdSort, getSortArrow,
    prefillInbound: () => {}, prefillOutbound: () => {},
    renderInbound:()=>{}, renderOutbound:()=>{}, renderMovements:()=>{},
    renderCSV:()=>{}, renderReports:()=>{}, renderSettings:()=>{} };
})();
window.Sections = Sections;
