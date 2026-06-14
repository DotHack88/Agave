/* ============================
   AgaveWMS – Sections Renderer
   Part 1: Dashboard & Products
   ============================ */
const Sections = (() => {
  /* ── CARD STYLING & ANIMATIONS ── */
  const styles = `
    .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); transition: transform 0.15s ease, box-shadow 0.15s ease; overflow: hidden; }
    .card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
    .sidebar-overlay { opacity: 0; transition: opacity 0.2s ease; }
    .sidebar-overlay.active { opacity: 1; }
    .btn:hover { background-color: var(--primary-light); color: var(--text); }
  `;
  document.head.insertAdjacentHTML('beforeend', `<style>${styles}</style>`);

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
    const settings = DB.Settings.get();

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
          <div class="ri-name product-link" onclick="Sections.showProductActions(${m.productId})">${App.escape(m.productName)}</div>
          <div class="ri-meta">${App.fmtDate(m.date)} • ${m.operator}</div>
        </div>
        <div class="ri-qty ${m.type}">${m.type==='in'?'+':'-'}${m.qty}</div>
      </div>`).join('')||'<div class="empty-state" style="padding:20px"><p>Nessun movimento</p></div>'}</div>
  </div>

  ${settings.lowStockAlert ? `
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
          <div class="ri-name product-link" onclick="Sections.showProductActions(${p.id})">${App.escape(p.name)}</div>
          <div class="ri-meta">${p.code || '—'} • Min: ${p.qtyMin}</div>
          <div class="stock-bar" style="margin-top:4px;max-width:120px">
            <div class="stock-bar-track"><div class="stock-bar-fill ${stockClass}" style="width:${stockPct}%"></div></div>
          </div>
        </div>
        <span class="badge ${badge}" style="margin-right:6px">${p.qty}</span>
        <div class="td-actions">
          <button class="btn btn-success btn-sm" onclick="Sections.quickIncrement(${p.id})" title="Carica">+</button>
          <button class="btn btn-danger btn-sm" onclick="Sections.quickDecrement(${p.id})" title="Scarica">-</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state" style="padding:20px"><div class="es-icon">✅</div><p>Tutti i prodotti sono sopra la scorta minima</p></div>'}</div>
  </div>` : ''}
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

    // Apply sorting (collapsing multiple spaces and ignoring for comparison)
    if (prodFilters.sortKey) {
      prods.sort((a, b) => {
        let valA = a[prodFilters.sortKey];
        let valB = b[prodFilters.sortKey];
        if (typeof valA === 'string') {
          const cleanA = valA.toLowerCase().replace(/\s+/g, '');
          const cleanB = (valB || '').toLowerCase().replace(/\s+/g, '');
          return prodFilters.sortOrder === 'asc' ? cleanA.localeCompare(cleanB) : cleanB.localeCompare(cleanA);
        } else {
          valA = valA || 0;
          valB = valB || 0;
          return prodFilters.sortOrder === 'asc' ? valA - valB : valB - valA;
        }
      });
    }

    const canEdit = DB.Users.canEdit(App.getUser());
    const canDel = DB.Users.canDelete(App.getUser());

    const settings = DB.Settings.get();
    const rowHeight = settings.rowHeight || 'normal';
    const colWidthProduct = settings.colWidthProduct || 'wide';
    const showColCode = settings.showColCode !== false;
    const showColBrand = settings.showColBrand !== false;
    const showColModel = settings.showColModel !== false;
    const showColQty = settings.showColQty !== false;
    const showColMin = settings.showColMin !== false;

    const expectedCols = 3 + (showColCode?1:0) + (showColBrand?1:0) + (showColModel?1:0) + (showColQty?1:0) + (showColMin?1:0);
    const table = el.querySelector('#products-table');
    const actualCols = table ? table.querySelectorAll('thead th').length : 0;
    const hasStructure = el.querySelector('.filters-bar') !== null && actualCols === expectedCols;

    if (!hasStructure) {
      el.innerHTML = `
<div class="page-header">
  <h1>Prodotti <span id="prod-count-badge" style="color:var(--text2);font-size:1rem;font-weight:400">(${prods.length})</span></h1>
  <div class="actions">
    ${canEdit?`<button id="btn-edit-selected" class="btn hidden" style="background-color: var(--blue); color: white;" onclick="Sections.openMassEditForm()">✏️ Modifica Selezionati</button>`:''}
    ${canDel?`<button id="btn-delete-selected" class="btn btn-danger hidden" onclick="Sections.deleteSelectedProducts()">🗑️ Elimina Selezionati</button>`:''}
    ${canEdit?`<button class="btn btn-primary" onclick="Sections.openProductForm()">
      ➕ Nuovo Prodotto</button>`:''}
          <button class="btn btn-ghost" onclick="Sections.exportProducts()">⬇ Esporta</button>
  </div>
</div>
<div class="filters-bar">
  <input type="text" id="prod-filter-q" placeholder="🔍 Cerca per nome, codice, barcode, marca o modello..." value="${prodFilters.q}"
    oninput="Sections.setProdFilter('q',this.value)" style="flex:1;min-width:200px"/>
  <button class="btn btn-ghost btn-sm" onclick="Sections.openTableCustomization()">⚙️ Personalizza</button>
  <button class="btn btn-ghost btn-sm" onclick="Sections.resetProdFilters()">Reset</button>
</div>
<div class="table-wrap">
<table id="products-table" class="custom-table row-${rowHeight} col-prod-${colWidthProduct}">
<thead>
  <tr>
    <th style="width:40px;text-align:center"><input type="checkbox" id="prod-select-all" onclick="Sections.toggleAllProducts(this)"></th>
    ${showColCode ? `<th style="cursor:pointer; width: 110px;" onclick="Sections.toggleProdSort('code')">Codice ${getSortArrow('code')}</th>` : ''}
    <th style="cursor:pointer; ${colWidthProduct === 'wide' ? 'width: 35%;' : colWidthProduct === 'extra-wide' ? 'width: 45%;' : 'width: 25%;'}" onclick="Sections.toggleProdSort('name')">Prodotto ${getSortArrow('name')}</th>
    ${showColBrand ? `<th style="cursor:pointer; width: 12%;" onclick="Sections.toggleProdSort('brand')">Marca ${getSortArrow('brand')}</th>` : ''}
    ${showColModel ? `<th style="cursor:pointer; width: 8%;" onclick="Sections.toggleProdSort('model')">Modello ${getSortArrow('model')}</th>` : ''}
    ${showColQty ? `<th style="cursor:pointer; width: 10%;" onclick="Sections.toggleProdSort('qty')">Giacenza ${getSortArrow('qty')}</th>` : ''}
    ${showColMin ? `<th style="cursor:pointer; width: 8%;" onclick="Sections.toggleProdSort('qtyMin')">Scorta min. ${getSortArrow('qtyMin')}</th>` : ''}
    <th style="width: 100px;">Azioni</th>
  </tr>
</thead>
<tbody id="products-tbody"></tbody>
</table>
</div>`;
    } else {
      const headers = el.querySelectorAll('thead th');
      let hIdx = 1;
      if (showColCode && headers[hIdx]) headers[hIdx++].innerHTML = `Codice ${getSortArrow('code')}`;
      if (headers[hIdx]) headers[hIdx++].innerHTML = `Prodotto ${getSortArrow('name')}`;
      if (showColBrand && headers[hIdx]) headers[hIdx++].innerHTML = `Marca ${getSortArrow('brand')}`;
      if (showColModel && headers[hIdx]) headers[hIdx++].innerHTML = `Modello ${getSortArrow('model')}`;
      if (showColQty && headers[hIdx]) headers[hIdx++].innerHTML = `Giacenza ${getSortArrow('qty')}`;
      if (showColMin && headers[hIdx]) headers[hIdx++].innerHTML = `Scorta min. ${getSortArrow('qtyMin')}`;
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
          <td style="text-align:center"><input type="checkbox" class="prod-checkbox" value="${p.id}" onclick="Sections.updateDeleteSelectedButton()"></td>
          ${showColCode ? `<td><div class="td-code">${p.code}</div>${p.barcode?`<div class="td-code" style="font-size:.7rem;color:var(--text3)">${p.barcode}</div>`:''}</td>` : ''}
          <td class="product-link" style="font-weight:600" onclick="Sections.showProductActions(${p.id})">${App.escape(p.name)}</td>
          ${showColBrand ? `<td>${App.escape(p.brand||'—')}</td>` : ''}
          ${showColModel ? `<td>${App.escape(p.model||'—')}</td>` : ''}
          ${showColQty ? `<td>
            <span class="badge ${badge}">${p.qty}</span>
            <div class="stock-bar" style="margin-top:4px;min-width:60px"><div class="stock-bar-track"><div class="stock-bar-fill ${stockClass}" style="width:${stockPct}%"></div></div></div>
          </td>` : ''}
          ${showColMin ? `<td>${p.qtyMin}</td>` : ''}
          <td><div class="td-actions">
            ${canEdit?`<button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.editProduct(${p.id})" title="Modifica">✏️</button>`:'' }
            ${canDel?`<button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.deleteProduct(${p.id})" title="Elimina">🗑️</button>`:''}
            <button class="btn btn-success btn-sm" onclick="Sections.quickIncrement(${p.id})">+</button>
            <button class="btn btn-danger btn-sm" onclick="Sections.quickDecrement(${p.id})">-</button>
          </div></td>
        </tr>`;
      }).join('') : `<tr><td colspan="${expectedCols}"><div class="empty-state"><div class="es-icon">📦</div><h3>Nessun prodotto trovato</h3><p>Prova a modificare i filtri o aggiungine uno nuovo</p></div></td></tr>`;
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

  // ── BRAND AUTOCOMPLETE ──
  // This function updates the <datalist> for the brand input field as the user types.
  // It performs a case‑insensitive prefix match against all existing brand names.
  // If no matches are found, it falls back to showing the full list.
  function updateBrandSuggestions(query) {
    const datalist = document.getElementById('brand-suggestions');
    if (!datalist) return;
    const allBrands = DB.Products.brands();
    const filtered = allBrands.filter(b => b.toLowerCase().startsWith(query.toLowerCase()));
    const options = (filtered.length ? filtered : allBrands)
      .map(b => `<option value="${App.escape(b)}"></option>`)
      .join('');
    datalist.innerHTML = options;
  }

  function productFormHTML(p = {}) {
    const brands = DB.Products.brands();
    const brandOptions = brands.map(b => `<option value="${App.escape(b)}"></option>`).join('');
    return `<div class="form-grid">
      <div class="form-group"><label>Barcode / EAN</label><input id="pf-barcode" value="${App.escape(p.barcode||'')}" placeholder="8001234567890"/></div>
      <div class="form-group span-2"><label>Nome Prodotto *</label><input id="pf-name" value="${App.escape(p.name||'')}" placeholder="Nome del prodotto"/></div>
      <div class="form-group">
        <label>Marca</label>
        <input id="pf-brand" value="${App.escape(p.brand||'')}" placeholder="Marca" list="brand-suggestions" autocomplete="off" oninput="Sections.updateBrandSuggestions(this.value)"/>
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
    if (id) {
      // Editing existing product – check if qty changed to register movement
      const oldProd = DB.Products.find(id);
      const oldQty = oldProd ? (oldProd.qty || 0) : 0;
      const oldQtyMin = oldProd ? (oldProd.qtyMin || 0) : 0;
      const delta = (data.qty || 0) - oldQty;
      if (delta === 0) delete data.qty;
      if (data.qtyMin === oldQtyMin) delete data.qtyMin;
      DB.Products.update(id, data);
      if (delta !== 0) {
        const updatedProd = DB.Products.find(id);
        DB.Movements.create({
          type: delta > 0 ? 'in' : 'out',
          productId: updatedProd.id,
          productCode: updatedProd.code,
          productName: updatedProd.name,
          qty: Math.abs(delta),
          brand: updatedProd.brand || '',
          model: updatedProd.model || '',
          operator: App.getUser()?.name || 'admin',
          notes: delta > 0 ? 'Carico da modifica prodotto' : 'Scarico da modifica prodotto'
        });
      }
      App.toast('Prodotto aggiornato','success');
    } else {
      const created = DB.Products.create(data);
      // Automatically register inbound movement for initial stock
      if (created && (created.qty || 0) > 0) {
        DB.Movements.create({
          type: 'in',
          productId: created.id,
          productCode: created.code,
          productName: created.name,
          qty: created.qty,
          brand: created.brand || '',
          model: created.model || '',
          operator: App.getUser()?.name || 'admin',
          notes: 'Carico iniziale da creazione prodotto'
        });
      }
      App.toast('Prodotto creato','success');
    }
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

  function quickIncrement(productId) {
    const p = DB.Products.find(productId);
    if (!p) { App.toast('Prodotto non trovato', 'error'); return; }
    const qty = 1;
    DB.Products.updateQty(productId, qty);
    DB.Movements.create({
      type: 'in',
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      qty: qty,
      brand: p.brand || '',
      model: p.model || '',
      operator: App.getUser()?.name || 'admin',
      notes: 'Carico rapido'
    });
    App.toast(`Caricato ${qty}x ${p.name}`, 'success');
    App.updateNotifications();
    const activeSection = document.querySelector('.nav-item.active')?.dataset?.section;
    if (activeSection === 'products') {
      renderProducts();
    } else if (activeSection === 'dashboard') {
      renderDashboard();
    } else if (activeSection === 'movements') {
      Sections.renderMovements();
    } else if (activeSection === 'inbound') {
      Sections.renderInbound();
    } else if (activeSection === 'outbound') {
      Sections.renderOutbound();
    } else if (activeSection === 'reports') {
      Sections.renderReports();
    }
  }

  function quickDecrement(productId) {
    const p = DB.Products.find(productId);
    if (!p) { App.toast('Prodotto non trovato', 'error'); return; }
    if ((p.qty || 0) < 1) {
      App.toast('Quantità insufficiente per lo scarico', 'error');
      return;
    }
    const qty = 1;
    DB.Products.updateQty(productId, -qty);
    DB.Movements.create({
      type: 'out',
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      qty: qty,
      brand: p.brand || '',
      model: p.model || '',
      operator: App.getUser()?.name || 'admin',
      notes: 'Scarico rapido'
    });
    App.toast(`Scaricato ${qty}x ${p.name}`, 'success');
    App.updateNotifications();
    const activeSection = document.querySelector('.nav-item.active')?.dataset?.section;
    if (activeSection === 'products') {
      renderProducts();
    } else if (activeSection === 'dashboard') {
      renderDashboard();
    } else if (activeSection === 'movements') {
      Sections.renderMovements();
    } else if (activeSection === 'inbound') {
      Sections.renderInbound();
    } else if (activeSection === 'outbound') {
      Sections.renderOutbound();
    } else if (activeSection === 'reports') {
      Sections.renderReports();
    }
  }

  function showProductActions(productId) {
    const p = DB.Products.find(productId);
    if (!p) {
      App.toast('Prodotto non trovato o eliminato', 'warning');
      return;
    }
    const canEdit = DB.Users.canEdit(App.getUser());
    const canDel = DB.Users.canDelete(App.getUser());
    
    const bodyHTML = `
      <div style="text-align:center;padding:10px 0">
        <div style="font-size:3rem;margin-bottom:12px">📦</div>
        <h3 style="margin-bottom:6px;font-size:1.2rem;font-weight:700">${App.escape(p.name)}</h3>
        <p style="color:var(--text2);font-size:.85rem;margin-bottom:12px">Codice: ${p.code} | Barcode: ${p.barcode || '—'}</p>
        <p style="font-size:1.1rem;font-weight:700;margin-bottom:16px">Giacenza: <span class="badge ${p.qty===0?'badge-red':p.qty<=p.qtyMin?'badge-yellow':'badge-green'}">${p.qty} pz</span></p>
        <div style="display:flex;flex-direction:column;gap:8px;max-width:260px;margin:0 auto">
          <div style="display:flex;gap:8px">
            <button class="btn btn-success" style="flex:1;justify-content:center" onclick="App.closeModal();Sections.quickIncrement(${p.id})">➕ Carica</button>
            <button class="btn btn-danger" style="flex:1;justify-content:center" onclick="App.closeModal();Sections.quickDecrement(${p.id})">➖ Scarica</button>
          </div>
          ${canEdit ? `<button class="btn btn-primary" style="justify-content:center" onclick="App.closeModal();App.navigate('products');Sections.editProduct(${p.id})">✏️ Modifica</button>` : ''}
          ${canDel ? `<button class="btn btn-ghost" style="justify-content:center;color:var(--red)" onclick="App.closeModal();App.navigate('products');Sections.deleteProduct(${p.id})">🗑️ Elimina</button>` : ''}
        </div>
      </div>
    `;
    App.openModal('Azioni Prodotto', bodyHTML, `<button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>`);
  }

  function openTableCustomization() {
    const settings = DB.Settings.get();
    const rowHeight = settings.rowHeight || 'normal';
    const colWidthProduct = settings.colWidthProduct || 'wide';
    const showColCode = settings.showColCode !== false;
    const showColBrand = settings.showColBrand !== false;
    const showColModel = settings.showColModel !== false;
    const showColQty = settings.showColQty !== false;
    const showColMin = settings.showColMin !== false;

    const bodyHTML = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="form-group">
          <label>Spaziatura Righe</label>
          <select id="cust-row-height" class="form-control" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
            <option value="compact" ${rowHeight === 'compact' ? 'selected' : ''}>Compatta (Righe strette)</option>
            <option value="normal" ${rowHeight === 'normal' ? 'selected' : ''}>Normale (Standard)</option>
            <option value="cozy" ${rowHeight === 'cozy' ? 'selected' : ''}>Spaziosa (Righe alte)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Larghezza Sezione Prodotto</label>
          <select id="cust-col-width" class="form-control" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
            <option value="normal" ${colWidthProduct === 'normal' ? 'selected' : ''}>Stretta</option>
            <option value="wide" ${colWidthProduct === 'wide' ? 'selected' : ''}>Media (Consigliata)</option>
            <option value="extra-wide" ${colWidthProduct === 'extra-wide' ? 'selected' : ''}>Larga</option>
          </select>
        </div>
        <div class="form-group">
          <label>Mostra / Nascondi Colonne</label>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="cust-col-code" ${showColCode ? 'checked' : ''} /> Codice / Barcode
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="cust-col-brand" ${showColBrand ? 'checked' : ''} /> Marca
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="cust-col-model" ${showColModel ? 'checked' : ''} /> Modello
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="cust-col-qty" ${showColQty ? 'checked' : ''} /> Giacenza
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="cust-col-min" ${showColMin ? 'checked' : ''} /> Scorta Minima
            </label>
          </div>
        </div>
      </div>
    `;

    App.openModal('Personalizza Tabella Prodotti', bodyHTML, `
      <button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
      <button class="btn btn-primary" onclick="Sections.saveTableCustomization()">💾 Applica</button>
    `);
  }

  function saveTableCustomization() {
    const rowHeight = document.getElementById('cust-row-height').value;
    const colWidthProduct = document.getElementById('cust-col-width').value;
    const showColCode = document.getElementById('cust-col-code').checked;
    const showColBrand = document.getElementById('cust-col-brand').checked;
    const showColModel = document.getElementById('cust-col-model').checked;
    const showColQty = document.getElementById('cust-col-qty').checked;
    const showColMin = document.getElementById('cust-col-min').checked;

    DB.Settings.set({
      rowHeight,
      colWidthProduct,
      showColCode,
      showColBrand,
      showColModel,
      showColQty,
      showColMin
    });

    App.toast('Tabella personalizzata', 'success');
    App.closeModal();
    const el = document.getElementById('section-products');
    if (el) el.innerHTML = '';
    renderProducts();
  }

  function deleteProduct(id) {
    if (!id) {
      // Attempt to find a product with code "undefined"
      const maybeProd = DB.Products.all().find(prod => prod.code === 'undefined' || prod.code === undefined);
      if (maybeProd) {
        id = maybeProd.id;
      } else {
        App.toast('ID prodotto non valido','error');
        return;
      }
    }
    const p = DB.Products.find(id);
    if (!p) {
      App.toast('Prodotto non trovato','error');
      return;
    }
    App.confirm(`Eliminare il prodotto "${p.name}"? L'operazione non è reversibile.`, () => {
      DB.Products.delete(id);
      App.toast('Prodotto eliminato','warning');
      App.updateNotifications();
      // Refresh the product list view if currently displayed
      const currentSection = document.getElementById('section-products');
      if (currentSection) {
        renderProducts();
      }
    });
  }

  function toggleAllProducts(source) {
    const checkboxes = document.querySelectorAll('.prod-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateDeleteSelectedButton();
  }

  function updateDeleteSelectedButton() {
    const btnDel = document.getElementById('btn-delete-selected');
    const btnEdit = document.getElementById('btn-edit-selected');
    const checked = document.querySelectorAll('.prod-checkbox:checked');
    
    if (btnDel) {
      if (checked.length > 0) {
        btnDel.classList.remove('hidden');
        btnDel.textContent = `🗑️ Elimina Selezionati (${checked.length})`;
      } else {
        btnDel.classList.add('hidden');
      }
    }
    if (btnEdit) {
      if (checked.length > 0) {
        btnEdit.classList.remove('hidden');
        btnEdit.textContent = `✏️ Modifica Selezionati (${checked.length})`;
      } else {
        btnEdit.classList.add('hidden');
      }
    }
    const selectAll = document.getElementById('prod-select-all');
    if (selectAll) {
      const allBoxes = document.querySelectorAll('.prod-checkbox');
      selectAll.checked = allBoxes.length > 0 && checked.length === allBoxes.length;
    }
  }

  function deleteSelectedProducts() {
    const checked = document.querySelectorAll('.prod-checkbox:checked');
    if (checked.length === 0) return;
    
    App.confirm(`Eliminare definitivamente ${checked.length} prodotti selezionati? L'operazione non è reversibile.`, () => {
      checked.forEach(cb => {
        DB.Products.delete(parseInt(cb.value, 10));
      });
      App.toast(`${checked.length} prodotti eliminati`, 'warning');
      App.updateNotifications();
      const el = document.getElementById('section-products');
      if (el) el.innerHTML = '';
      renderProducts();
    });
  }

  function openMassEditForm() {
    const checked = document.querySelectorAll('.prod-checkbox:checked');
    if (checked.length === 0) return;
    const ids = Array.from(checked).map(cb => parseInt(cb.value, 10));

    const formHTML = `
      <form onsubmit="Sections.saveMassEdit(event, [${ids.join(',')}])">
        <p style="margin-bottom:15px; color:var(--text2)">Lascia vuoto il campo se non vuoi modificarlo.</p>
        <div class="form-group">
          <label>Nuova Marca</label>
          <input type="text" id="mass-brand" placeholder="Es. La Saponaria" />
        </div>
        <div class="form-group">
          <label>Nuovo Modello</label>
          <input type="text" id="mass-model" placeholder="Es. 100 ml" />
        </div>
        <div style="margin-top:20px;text-align:right">
          <button type="button" class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
          <button type="submit" class="btn btn-primary">Applica Modifica</button>
        </div>
      </form>
    `;
    App.openModal(`Modifica Massiva (${ids.length} prodotti)`, formHTML);
  }

  function saveMassEdit(e, ids) {
    e.preventDefault();
    const newBrand = document.getElementById('mass-brand').value.trim();
    const newModel = document.getElementById('mass-model').value.trim();

    if (!newBrand && !newModel) {
      App.toast('Nessuna modifica inserita', 'info');
      App.closeModal();
      return;
    }

    let updatedCount = 0;
    ids.forEach(id => {
      const p = DB.Products.find(id);
      if (p) {
        const updateData = {};
        if (newBrand) updateData.brand = newBrand;
        if (newModel) updateData.model = newModel;
        DB.Products.update(id, updateData);
        updatedCount++;
      }
    });

    App.toast(`${updatedCount} prodotti aggiornati`, 'success');
    App.closeModal();
    App.updateNotifications();
    const el = document.getElementById('section-products');
    if (el) el.innerHTML = '';
    renderProducts();
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
    toggleProdSort, getSortArrow, toggleAllProducts, updateDeleteSelectedButton, deleteSelectedProducts,
    openMassEditForm, saveMassEdit,
    quickIncrement, quickDecrement, showProductActions, openTableCustomization, saveTableCustomization,
    prefillInbound: () => {},
    prefillOutbound: (productId) => {
      const p = DB.Products.find(productId);
      if (!p) { App.toast('Prodotto non trovato','error'); return; }
      const qty = 1; // default quantity to subtract
      if ((p.qty || 0) < qty) {
        App.toast('Quantità insufficiente per lo scarico','error');
        return;
      }
      // Update product quantity
      DB.Products.update(productId, { qty: (p.qty || 0) - qty });
      // Register outbound movement
      DB.Movements.create({
        type: 'out',
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        qty: qty,
        brand: p.brand || '',
        model: p.model || '',
        operator: App.getUser()?.name || 'admin',
        notes: 'Scarico rapido da lista prodotti'
      });
      App.toast(`Scaricato ${qty} ${p.name}`, 'success');
      App.updateNotifications();
      // Refresh UI if currently on outbound tab
      if (document.getElementById('section-outbound')) {
        Sections.renderOutbound();
      }
    },
    renderInbound:()=>{}, renderOutbound:()=>{}, renderMovements:()=>{},
    renderInbound:()=>{}, renderOutbound:()=>{}, renderMovements:()=>{},
    renderCSV:()=>{}, renderReports:()=>{}, renderSettings:()=>{} };
})();
window.Sections = Sections;
