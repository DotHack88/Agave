/* AgaveWMS – Sections 2: Inbound, Outbound, Movements */
let _prefillInboundId = null, _prefillOutboundId = null;

Object.assign(Sections, {
  prefillInbound(id) { _prefillInboundId = id; },
  prefillOutbound(id) { _prefillOutboundId = id; },

  renderInbound() {
    const el = document.getElementById('section-inbound');
    const prods = DB.Products.active();
    const pre = _prefillInboundId ? DB.Products.find(_prefillInboundId) : null;
    _prefillInboundId = null;
    el.innerHTML = `
<div class="page-header"><h1>Entrata Merci</h1></div>
<div class="grid-2">
<div class="card">
  <div class="card-header"><span class="card-title">📥 Registra Carico</span></div>
  <div class="form-group"><label>Prodotto *</label>
    <select id="ib-prod" onchange="Sections._inboundProdChanged()">
      <option value="">-- Seleziona prodotto --</option>
      ${prods.map(p=>`<option value="${p.id}" ${pre&&pre.id===p.id?'selected':''}>${p.code} – ${p.name}</option>`).join('')}
    </select>
  </div>
  <div id="ib-prod-info" style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px;margin-bottom:14px;font-size:.85rem;display:${pre?'block':'none'}">
    ${pre?`<b>${pre.name}</b> &nbsp;|&nbsp; Giacenza attuale: <b>${pre.qty}</b> pz &nbsp;|&nbsp; Scorta min: <b>${pre.qtyMin}</b>`:''}
  </div>
  <div class="form-grid">
    <div class="form-group"><label>Quantità *</label><input id="ib-qty" type="number" min="1" value="1"/></div>
    <div class="form-group"><label>Costo Acquisto (€)</label><input id="ib-price" type="number" min="0" step="0.01" value="${pre?pre.priceBuy:0}"/></div>
    <div class="form-group"><label>Data Entrata</label><input id="ib-date" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>
    <div class="form-group"><label>N° Documento/Fattura</label><input id="ib-doc" placeholder="FAT-2024-001"/></div>
    <div class="form-group span-2"><label>Fornitore</label><input id="ib-supplier" list="ib-sup-list" value="${pre?pre.supplier:''}"/>
      <datalist id="ib-sup-list">${DB.Products.suppliers().map(s=>`<option value="${s}">`).join('')}</datalist>
    </div>
    <div class="form-group span-2"><label>Note</label><textarea id="ib-notes" placeholder="Note carico..."></textarea></div>
  </div>
  <div style="display:flex;gap:10px;margin-top:8px">
    <button class="btn btn-success" onclick="Sections._saveInbound()">
      <svg viewBox="0 0 24 24" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>Registra Entrata
    </button>
    <button class="btn btn-ghost" onclick="Sections._clearInbound()">Reset</button>
  </div>
</div>
<div class="card">
  <div class="card-header"><span class="card-title">🕐 Ultime Entrate</span></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Data</th><th>Prodotto</th><th>Qty</th><th>Fornitore</th><th>Doc.</th></tr></thead>
    <tbody>${DB.Movements.filter({type:'in'}).slice(0,10).map(m=>`<tr>
      <td style="font-size:.8rem">${App.fmtDate(m.date)}</td>
      <td><div style="font-weight:600;font-size:.85rem">${App.escape(m.productName)}</div></td>
      <td><span class="badge badge-green">+${m.qty}</span></td>
      <td style="font-size:.82rem">${App.escape(m.supplier||'—')}</td>
      <td class="td-code">${App.escape(m.document||'—')}</td>
    </tr>`).join('')||'<tr><td colspan="5"><div class="empty-state" style="padding:20px"><p>Nessuna entrata</p></div></td></tr>'}
    </tbody>
  </table></div>
</div></div>`;
    if (pre) Sections._inboundProdChanged();
  },

  _inboundProdChanged() {
    const sel = document.getElementById('ib-prod');
    const info = document.getElementById('ib-prod-info');
    const priceEl = document.getElementById('ib-price');
    const supEl = document.getElementById('ib-supplier');
    if (!sel.value) { info.style.display='none'; return; }
    const p = DB.Products.find(Number(sel.value));
    if (!p) return;
    info.style.display='block';
    info.innerHTML=`<b>${p.name}</b> &nbsp;|&nbsp; Giacenza: <b>${p.qty}</b> pz &nbsp;|&nbsp; Scorta min: <b>${p.qtyMin}</b>`;
    if (priceEl) priceEl.value = p.priceBuy;
    if (supEl && !supEl.value) supEl.value = p.supplier||'';
  },

  _saveInbound() {
    const prodId = Number(document.getElementById('ib-prod').value);
    const qty = Number(document.getElementById('ib-qty').value);
    if (!prodId) { App.toast('Seleziona un prodotto','error'); return; }
    if (!qty || qty <= 0) { App.toast('Quantità non valida','error'); return; }
    const p = DB.Products.find(prodId);
    DB.Movements.create({
      type:'in', productId:prodId, productCode:p.code, productName:p.name, qty,
      priceBuy: Number(document.getElementById('ib-price').value)||0,
      date: document.getElementById('ib-date').value,
      document: document.getElementById('ib-doc').value,
      supplier: document.getElementById('ib-supplier').value,
      notes: document.getElementById('ib-notes').value,
      operator: App.getUser()?.name||'admin'
    });
    DB.Products.updateQty(prodId, qty);
    App.toast(`+${qty} pz di "${p.name}" registrate`,'success');
    App.updateNotifications();
    Sections.renderInbound();
  },

  _clearInbound() { Sections.renderInbound(); },

  renderOutbound() {
    const el = document.getElementById('section-outbound');
    const prods = DB.Products.active().filter(p=>p.qty>0);
    el.innerHTML = `
<div class="page-header"><h1>Uscita Merci</h1></div>
<div class="grid-2">
<div class="card">
  <div class="card-header"><span class="card-title">📤 Registra Scarico</span></div>
  <div class="form-group"><label>Prodotto *</label>
    <select id="ob-prod" onchange="Sections._outboundProdChanged()">
      <option value="">-- Seleziona prodotto --</option>
      ${prods.map(p=>`<option value="${p.id}">${p.code} – ${p.name} (disp: ${p.qty})</option>`).join('')}
    </select>
  </div>
  <div id="ob-prod-info" style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px;margin-bottom:14px;font-size:.85rem;display:none"></div>
  <div class="form-grid">
    <div class="form-group"><label>Quantità *</label><input id="ob-qty" type="number" min="1" value="1"/></div>
    <div class="form-group"><label>Data Uscita</label><input id="ob-date" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>
    <div class="form-group"><label>Cliente / Destinazione</label><input id="ob-customer" placeholder="Nome cliente o destinazione"/></div>
    <div class="form-group"><label>N° Documento / DDT</label><input id="ob-doc" placeholder="DDT-2024-001"/></div>
    <div class="form-group span-2"><label>Note</label><textarea id="ob-notes" placeholder="Note uscita..."></textarea></div>
  </div>
  <div style="display:flex;gap:10px;margin-top:8px">
    <button class="btn btn-danger" onclick="Sections._saveOutbound()">
      <svg viewBox="0 0 24 24" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>Registra Uscita
    </button>
    <button class="btn btn-ghost" onclick="Sections.renderOutbound()">Reset</button>
  </div>
</div>
<div class="card">
  <div class="card-header"><span class="card-title">🕐 Ultime Uscite</span></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Data</th><th>Prodotto</th><th>Qty</th><th>Cliente</th><th>Doc.</th></tr></thead>
    <tbody>${DB.Movements.filter({type:'out'}).slice(0,10).map(m=>`<tr>
      <td style="font-size:.8rem">${App.fmtDate(m.date)}</td>
      <td><div style="font-weight:600;font-size:.85rem">${App.escape(m.productName)}</div></td>
      <td><span class="badge badge-red">-${m.qty}</span></td>
      <td style="font-size:.82rem">${App.escape(m.customer||'—')}</td>
      <td class="td-code">${App.escape(m.document||'—')}</td>
    </tr>`).join('')||'<tr><td colspan="5"><div class="empty-state" style="padding:20px"><p>Nessuna uscita</p></div></td></tr>'}
    </tbody>
  </table></div>
</div></div>`;
    if (_prefillOutboundId) {
      const sel = document.getElementById('ob-prod');
      if (sel) { sel.value = _prefillOutboundId; Sections._outboundProdChanged(); }
      _prefillOutboundId = null;
    }
  },

  _outboundProdChanged() {
    const sel = document.getElementById('ob-prod');
    const info = document.getElementById('ob-prod-info');
    if (!sel.value) { info.style.display='none'; return; }
    const p = DB.Products.find(Number(sel.value));
    if (!p) return;
    const low = p.qty <= p.qtyMin;
    info.style.display='block';
    info.innerHTML=`<b>${p.name}</b> &nbsp;|&nbsp; Disponibile: <b class="${low?'':''}"> ${p.qty}</b> pz
      ${low?'&nbsp;<span class="badge badge-yellow">⚠ Scorta bassa</span>':''}`;
  },

  _saveOutbound() {
    const prodId = Number(document.getElementById('ob-prod').value);
    const qty = Number(document.getElementById('ob-qty').value);
    if (!prodId) { App.toast('Seleziona un prodotto','error'); return; }
    if (!qty || qty <= 0) { App.toast('Quantità non valida','error'); return; }
    const p = DB.Products.find(prodId);
    if (qty > p.qty) { App.toast(`Quantità insufficiente! Disponibili: ${p.qty} pz`,'error'); return; }
    DB.Movements.create({
      type:'out', productId:prodId, productCode:p.code, productName:p.name, qty,
      date: document.getElementById('ob-date').value,
      customer: document.getElementById('ob-customer').value,
      document: document.getElementById('ob-doc').value,
      notes: document.getElementById('ob-notes').value,
      operator: App.getUser()?.name||'admin'
    });
    DB.Products.updateQty(prodId, -qty);
    App.toast(`-${qty} pz di "${p.name}" registrate`,'success');
    App.updateNotifications();
    Sections.renderOutbound();
  },

  renderMovements() {
    const el = document.getElementById('section-movements');
    const filt = window._movFilt || { type:'', q:'', from:'', to:'' };
    window._movFilt = filt;
    const moves = DB.Movements.filter(filt);
    el.innerHTML = `
<div class="page-header"><h1>Movimenti Magazzino</h1>
  <div class="actions">
    <button class="btn btn-ghost" onclick="Sections._exportMovements()">⬇ Esporta CSV</button>
  </div>
</div>
<div class="filters-bar">
  <select onchange="window._movFilt.type=this.value;Sections.renderMovements()">
    <option value="" ${!filt.type?'selected':''}>Tutti i tipi</option>
    <option value="in" ${filt.type==='in'?'selected':''}>📥 Entrate</option>
    <option value="out" ${filt.type==='out'?'selected':''}>📤 Uscite</option>
  </select>
  <input type="text" placeholder="🔍 Prodotto, documento..." value="${filt.q}"
    oninput="window._movFilt.q=this.value;Sections.renderMovements()" style="flex:1"/>
  <label style="font-size:.82rem;color:var(--text2)">Dal</label>
  <input type="date" value="${filt.from}" onchange="window._movFilt.from=this.value;Sections.renderMovements()"/>
  <label style="font-size:.82rem;color:var(--text2)">Al</label>
  <input type="date" value="${filt.to}" onchange="window._movFilt.to=this.value;Sections.renderMovements()"/>
  <button class="btn btn-ghost btn-sm" onclick="window._movFilt={type:'',q:'',from:'',to:''};Sections.renderMovements()">Reset</button>
</div>
<div class="table-wrap"><table>
<thead><tr><th>Tipo</th><th>Data</th><th>Prodotto</th><th>Codice</th><th>Qty</th><th>Fornitore/Cliente</th><th>Documento</th><th>Operatore</th><th>Note</th></tr></thead>
<tbody>${moves.length ? moves.map(m=>`<tr>
  <td><span class="badge ${m.type==='in'?'badge-green':'badge-red'}">${m.type==='in'?'📥 Entrata':'📤 Uscita'}</span></td>
  <td style="font-size:.82rem;white-space:nowrap">${App.fmtDate(m.date)}</td>
  <td style="font-weight:600;font-size:.87rem">${App.escape(m.productName)}</td>
  <td class="td-code">${App.escape(m.productCode||'')}</td>
  <td><span class="badge ${m.type==='in'?'badge-green':'badge-red'}">${m.type==='in'?'+':'-'}${m.qty}</span></td>
  <td style="font-size:.82rem">${App.escape(m.type==='in'?m.supplier||'—':m.customer||'—')}</td>
  <td class="td-code">${App.escape(m.document||'—')}</td>
  <td style="font-size:.8rem">${App.escape(m.operator||'')}</td>
  <td style="font-size:.8rem;color:var(--text2)">${App.escape(m.notes||'')}</td>
</tr>`).join('') : '<tr><td colspan="9"><div class="empty-state" style="padding:30px"><div class="es-icon">📋</div><h3>Nessun movimento trovato</h3></div></td></tr>'}
</tbody></table></div>`;
  },

  _exportMovements() {
    const filt = window._movFilt || {};
    const moves = DB.Movements.filter(filt);
    const h = ['tipo','data','prodotto','codice','quantita','fornitore_cliente','documento','operatore','note'];
    const rows = moves.map(m=>[m.type==='in'?'Entrata':'Uscita',m.date,m.productName,m.productCode||'',m.qty,
      m.type==='in'?m.supplier||'':m.customer||'',m.document||'',m.operator||'',m.notes||''].map(v=>`"${v}"`).join(','));
    const csv = [h.join(','),...rows].join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `movimenti_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    App.toast('Esportazione movimenti completata','success');
  }
});
