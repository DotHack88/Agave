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
    const out = DB.Products.outOfStock();
    const moves = DB.Movements.all().slice(0,8);
    const totalVal = DB.Products.totalValue();
    const totalQty = DB.Products.totalQty();

    el.innerHTML = `
<div class="page-header"><h1>Dashboard</h1>
  <div class="actions"><span style="color:var(--text2);font-size:.85rem">Aggiornato: ${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</span></div>
</div>
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-icon primary"><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
    <div class="stat-info"><div class="stat-value">${prods.length}</div><div class="stat-label">Prodotti totali</div></div>
  </div>
  <div class="stat-card">
    <div class="stat-icon green"><svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
    <div class="stat-info"><div class="stat-value">${totalQty.toLocaleString('it-IT')}</div><div class="stat-label">Unità in magazzino</div></div>
  </div>
  <div class="stat-card">
    <div class="stat-icon red"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
    <div class="stat-info"><div class="stat-value">${low.length}</div><div class="stat-label">Sotto scorta minima</div>
      ${out.length?`<div class="stat-delta down">⚠ ${out.length} esauriti</div>`:'<div class="stat-delta up">✓ Stock OK</div>'}
    </div>
  </div>
  <div class="stat-card">
    <div class="stat-icon yellow"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
    <div class="stat-info"><div class="stat-value">${App.fmt(totalVal,0)}</div><div class="stat-label">Valore magazzino</div></div>
  </div>
</div>
<div class="grid-2" style="margin-bottom:16px">
  <div class="card">
    <div class="card-header"><span class="card-title">📈 Entrate / Uscite ultimi 6 mesi</span></div>
    <div class="chart-wrap"><canvas id="chart-monthly"></canvas></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">🗂 Prodotti per categoria</span></div>
    <div class="chart-wrap"><canvas id="chart-cats"></canvas></div>
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
          <div class="ri-meta">${App.fmtDate(m.date)} • ${m.document||'—'} • ${m.operator}</div>
        </div>
        <div class="ri-qty ${m.type}">${m.type==='in'?'+':'-'}${m.qty}</div>
      </div>`).join('')||'<div class="empty-state" style="padding:20px"><p>Nessun movimento</p></div>'}</div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">⚠️ Scorte basse</span><button class="btn btn-ghost btn-sm" onclick="App.navigate('products')">Tutti →</button></div>
    ${low.length ? `<div class="table-wrap"><table><thead><tr><th>Prodotto</th><th>Disp.</th><th>Min.</th><th></th></tr></thead><tbody>
    ${low.slice(0,6).map(p=>`<tr>
      <td><div style="font-weight:600;font-size:.85rem">${App.escape(p.name)}</div><div class="td-code">${p.code}</div></td>
      <td><span class="badge ${p.qty===0?'badge-red':'badge-yellow'}">${p.qty}</span></td>
      <td><span class="badge badge-gray">${p.qtyMin}</span></td>
      <td><button class="btn btn-success btn-sm" onclick="App.navigate('inbound');Sections.prefillInbound(${p.id})">+ Carica</button></td>
    </tr>`).join('')}</tbody></table></div>` :
    '<div class="empty-state" style="padding:30px"><div class="es-icon">✅</div><h3>Tutte le scorte OK</h3></div>'}
  </div>
</div>`;

    // Render charts after DOM is ready
    setTimeout(() => {
      const monthly = DB.Movements.monthlyStats(6);
      Charts.bar('chart-monthly', {
        labels: monthly.map(m=>m.label),
        datasets: [
          { label:'Entrate', values: monthly.map(m=>m.in), color:'#10b981' },
          { label:'Uscite', values: monthly.map(m=>m.out), color:'#ef4444' }
        ]
      });
      // Category donut
      const cats = {};
      DB.Products.active().forEach(p => { cats[p.category||'Altro'] = (cats[p.category||'Altro']||0)+1; });
      const catKeys = Object.keys(cats).slice(0,6);
      Charts.donut('chart-cats', { labels: catKeys, values: catKeys.map(k=>cats[k]) });
    }, 50);
  }

  // ── PRODUCTS ──
  let prodFilters = { q:'', category:'', brand:'', supplier:'', lowStock:false, outOfStock:false };

  function renderProducts() {
    const el = document.getElementById('section-products');
    const cats = DB.Products.categories();
    const brands = DB.Products.brands();
    const suppliers = DB.Products.suppliers();
    const prods = DB.Products.filter(prodFilters);
    const canEdit = DB.Users.canEdit(App.getUser());
    const canDel = DB.Users.canDelete(App.getUser());

    el.innerHTML = `
<div class="page-header">
  <h1>Prodotti <span style="color:var(--text2);font-size:1rem;font-weight:400">(${prods.length})</span></h1>
  <div class="actions">
    ${canEdit?`<button class="btn btn-primary" onclick="Sections.openProductForm()">
      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nuovo Prodotto</button>`:''}
    <button class="btn btn-ghost" onclick="Sections.exportProducts()">⬇ Esporta</button>
  </div>
</div>
<div class="filters-bar">
  <input type="text" placeholder="🔍 Cerca prodotto, codice, barcode..." value="${prodFilters.q}"
    oninput="Sections.setProdFilter('q',this.value)" style="flex:1;min-width:200px"/>
  <select onchange="Sections.setProdFilter('category',this.value)">
    <option value="">Tutte le categorie</option>
    ${cats.map(c=>`<option value="${c}" ${prodFilters.category===c?'selected':''}>${c}</option>`).join('')}
  </select>
  <select onchange="Sections.setProdFilter('brand',this.value)">
    <option value="">Tutti i brand</option>
    ${brands.map(b=>`<option value="${b}" ${prodFilters.brand===b?'selected':''}>${b}</option>`).join('')}
  </select>
  <select onchange="Sections.setProdFilter('supplier',this.value)">
    <option value="">Tutti i fornitori</option>
    ${suppliers.map(s=>`<option value="${s}" ${prodFilters.supplier===s?'selected':''}>${s}</option>`).join('')}
  </select>
  <label style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer">
    <input type="checkbox" ${prodFilters.lowStock?'checked':''} onchange="Sections.setProdFilter('lowStock',this.checked)"/> Scorta bassa
  </label>
  <button class="btn btn-ghost btn-sm" onclick="Sections.resetProdFilters()">Reset</button>
</div>
<div class="table-wrap">
<table>
<thead><tr><th>Codice</th><th>Prodotto</th><th>Categoria</th><th>Marca</th><th>Giacenza</th><th>Scorta min.</th><th>P.Acquisto</th><th>P.Vendita</th><th>Ubicazione</th><th>Fornitore</th><th>Azioni</th></tr></thead>
<tbody>
${prods.length ? prods.map(p => {
  const stockPct = p.qtyMin > 0 ? Math.min(100, Math.round((p.qty/p.qtyMin)*100)) : 100;
  const stockClass = p.qty === 0 ? 'critical' : p.qty <= p.qtyMin ? 'low' : 'ok';
  const badge = p.qty === 0 ? 'badge-red' : p.qty <= p.qtyMin ? 'badge-yellow' : 'badge-green';
  const imgHtml = p.image ? `<img src="${p.image}" style="width:36px;height:36px;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--border);flex-shrink:0" />` : `<div style="width:36px;height:36px;background:var(--bg3);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:.8rem;flex-shrink:0">📦</div>`;
  return `<tr>
    <td><div class="td-code">${p.code}</div>${p.barcode?`<div class="td-code" style="font-size:.7rem;color:var(--text3)">${p.barcode}</div>`:''}</td>
    <td style="max-width:240px">
      <div style="display:flex;align-items:center;gap:10px">
        ${imgHtml}
        <div>
          <div style="font-weight:600">${App.escape(p.name)}</div>
          ${p.notes?`<div style="font-size:.75rem;color:var(--text2)">${App.escape(p.notes)}</div>`:''}
        </div>
      </div>
    </td>
    <td><span class="badge badge-primary">${App.escape(p.category||'—')}</span></td>
    <td>${App.escape(p.brand||'—')}</td>
    <td>
      <span class="badge ${badge}">${p.qty}</span>
      <div class="stock-bar" style="margin-top:4px;min-width:60px"><div class="stock-bar-track"><div class="stock-bar-fill ${stockClass}" style="width:${stockPct}%"></div></div></div>
    </td>
    <td>${p.qtyMin}</td>
    <td>${App.fmt(p.priceBuy)}</td>
    <td>${App.fmt(p.priceSell)}</td>
    <td><code style="font-size:.78rem">${App.escape(p.location||'—')}</code></td>
    <td style="font-size:.82rem">${App.escape(p.supplier||'—')}</td>
    <td><div class="td-actions">
      ${canEdit?`<button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.editProduct(${p.id})" title="Modifica">✏️</button>
      <button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.duplicateProduct(${p.id})" title="Duplica">📋</button>`:'' }
      ${canDel?`<button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.deleteProduct(${p.id})" title="Elimina">🗑️</button>`:''}
      <button class="btn btn-success btn-sm" onclick="App.navigate('inbound');Sections.prefillInbound(${p.id})">+</button>
      <button class="btn btn-danger btn-sm" onclick="App.navigate('outbound');Sections.prefillOutbound(${p.id})">-</button>
    </div></td>
  </tr>`;
}).join('') : '<tr><td colspan="11"><div class="empty-state"><div class="es-icon">📦</div><h3>Nessun prodotto trovato</h3><p>Prova a modificare i filtri o aggiungine uno nuovo</p></div></td></tr>'}
</tbody></table></div>`;
  }

  function setProdFilter(key, val) {
    prodFilters[key] = val;
    renderProducts();
  }
  function resetProdFilters() {
    prodFilters = { q:'', category:'', brand:'', supplier:'', lowStock:false, outOfStock:false };
    renderProducts();
  }

  function handleProductImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('pf-image-preview').src = e.target.result;
      document.getElementById('pf-image-preview').style.display = 'block';
      document.getElementById('pf-image-data').value = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function productFormHTML(p = {}) {
    const cats = DB.Products.categories();
    const suppliers = DB.Products.suppliers();
    return `<div class="form-grid">
      <div class="form-group"><label>Codice Prodotto</label><input id="pf-code" value="${App.escape(p.code||'')}" placeholder="Auto generato"/></div>
      <div class="form-group"><label>Barcode / EAN</label><input id="pf-barcode" value="${App.escape(p.barcode||'')}" placeholder="8001234567890"/></div>
      <div class="form-group span-2"><label>Nome Prodotto *</label><input id="pf-name" value="${App.escape(p.name||'')}" placeholder="Nome del prodotto"/></div>
      <div class="form-group"><label>Categoria</label>
        <input id="pf-category" list="cat-list" value="${App.escape(p.category||'')}" placeholder="Categoria"/>
        <datalist id="cat-list">${cats.map(c=>`<option value="${c}">`).join('')}</datalist>
      </div>
      <div class="form-group"><label>Marca</label><input id="pf-brand" value="${App.escape(p.brand||'')}" placeholder="Marca"/></div>
      <div class="form-group"><label>Quantità disponibile</label><input id="pf-qty" type="number" min="0" value="${p.qty||0}"/></div>
      <div class="form-group"><label>Quantità minima (scorta)</label><input id="pf-qtyMin" type="number" min="0" value="${p.qtyMin||0}"/></div>
      <div class="form-group"><label>Prezzo Acquisto (€)</label><input id="pf-priceBuy" type="number" min="0" step="0.01" value="${p.priceBuy||0}"/></div>
      <div class="form-group"><label>Prezzo Vendita (€)</label><input id="pf-priceSell" type="number" min="0" step="0.01" value="${p.priceSell||0}"/></div>
      <div class="form-group"><label>Fornitore</label>
        <input id="pf-supplier" list="sup-list" value="${App.escape(p.supplier||'')}" placeholder="Fornitore"/>
        <datalist id="sup-list">${suppliers.map(s=>`<option value="${s}">`).join('')}</datalist>
      </div>
      <div class="form-group"><label>Ubicazione</label><input id="pf-location" value="${App.escape(p.location||'')}" placeholder="A-01-01"/></div>
      
      <div class="form-group span-2">
        <label>Immagine Prodotto</label>
        <div style="display:flex;align-items:center;gap:16px;margin-top:4px">
          <img id="pf-image-preview" src="${p.image||''}" style="width:72px;height:72px;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--border);display:${p.image?'block':'none'}" />
          <input type="file" accept="image/*" onchange="Sections.handleProductImageUpload(this)" style="font-size:.85rem"/>
          <input type="hidden" id="pf-image-data" value="${p.image||''}"/>
        </div>
      </div>

      <div class="form-group span-2"><label>Descrizione</label><textarea id="pf-desc" placeholder="Descrizione prodotto">${App.escape(p.description||'')}</textarea></div>
      <div class="form-group span-2"><label>Note</label><textarea id="pf-notes" placeholder="Note aggiuntive">${App.escape(p.notes||'')}</textarea></div>
    </div>`;
  }

  function getProductFormData() {
    return {
      code: document.getElementById('pf-code').value.trim(),
      barcode: document.getElementById('pf-barcode').value.trim(),
      name: document.getElementById('pf-name').value.trim(),
      category: document.getElementById('pf-category').value.trim(),
      brand: document.getElementById('pf-brand').value.trim(),
      qty: Number(document.getElementById('pf-qty').value) || 0,
      qtyMin: Number(document.getElementById('pf-qtyMin').value) || 0,
      priceBuy: Number(document.getElementById('pf-priceBuy').value) || 0,
      priceSell: Number(document.getElementById('pf-priceSell').value) || 0,
      supplier: document.getElementById('pf-supplier').value.trim(),
      location: document.getElementById('pf-location').value.trim(),
      image: document.getElementById('pf-image-data').value,
      description: document.getElementById('pf-desc').value.trim(),
      notes: document.getElementById('pf-notes').value.trim()
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
    App.closeModal(); App.updateNotifications(); renderProducts();
  }

  function duplicateProduct(id) {
    const p = DB.Products.duplicate(id);
    App.toast(`Prodotto "${p.name}" duplicato`,'info');
    renderProducts();
  }

  function deleteProduct(id) {
    const p = DB.Products.find(id);
    App.confirm(`Eliminare il prodotto "${p?.name}"? L'operazione non è reversibile.`, () => {
      DB.Products.delete(id); App.toast('Prodotto eliminato','warning'); App.updateNotifications(); renderProducts();
    });
  }

  function exportProducts() {
    const prods = DB.Products.filter(prodFilters);
    const headers = ['codice','barcode','nome','categoria','marca','quantita','quantita_minima','prezzo_acquisto','prezzo_vendita','fornitore','ubicazione','descrizione'];
    const rows = prods.map(p=>[p.code,p.barcode,p.name,p.category,p.brand,p.qty,p.qtyMin,p.priceBuy,p.priceSell,p.supplier,p.location,p.description].map(v=>`"${v||''}"`).join(','));
    const csv = [headers.join(','),...rows].join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `prodotti_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    App.toast('Esportazione completata','success');
  }

  return { render, renderDashboard, renderProducts, setProdFilter, resetProdFilters,
    openProductForm, editProduct, saveProduct, duplicateProduct, deleteProduct, exportProducts,
    handleProductImageUpload,
    prefillInbound: () => {}, prefillOutbound: () => {},
    renderInbound:()=>{}, renderOutbound:()=>{}, renderMovements:()=>{},
    renderCSV:()=>{}, renderReports:()=>{}, renderSettings:()=>{} };
})();
window.Sections = Sections;
