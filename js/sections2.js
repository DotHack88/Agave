/* AgaveWMS – Sections 2: Inbound, Outbound, Movements */
let _prefillInboundId = null, _prefillOutboundId = null;

// Carts stored in memory
let inboundCart = [];
let outboundCart = [];

Object.assign(Sections, {
  prefillInbound(id) {
    const p = DB.Products.find(id);
    if (p) this.addToInboundCart(p);
  },
  prefillOutbound(id) {
    const p = DB.Products.find(id);
    if (p) this.addToOutboundCart(p);
  },

  // ── INBOUND CART ACTIONS ──
  addToInboundCart(product) {
    const existing = inboundCart.find(item => item.product.id === product.id);
    if (existing) {
      existing.qty++;
    } else {
      inboundCart.push({ product, qty: 1 });
    }
    this.renderInbound();
  },
  updateInboundQty(productId, qty) {
    const item = inboundCart.find(i => i.product.id === productId);
    if (item) {
      item.qty = Math.max(1, parseInt(qty) || 1);
    }
    this.renderInbound();
  },
  removeFromInboundCart(productId) {
    inboundCart = inboundCart.filter(i => i.product.id !== productId);
    this.renderInbound();
  },
  clearInboundCart() {
    inboundCart = [];
    this.renderInbound();
  },
  handleInboundBarcode(barcode) {
    const p = DB.Products.findByCode(barcode);
    if (p) {
      this.addToInboundCart(p);
      App.toast(`➕ ${p.name} aggiunto alla lista`, 'success');
    } else {
      App.toast(`⚠ Barcode non registrato: ${barcode}`, 'warning');
      App.openModal('Prodotto Non Trovato', `
        <p style="color:var(--text2)">Nessun prodotto trovato con codice/barcode <b>${App.escape(barcode)}</b>.</p>
        <p style="color:var(--text2);margin-top:8px">Vuoi registrarlo come nuovo prodotto?</p>
      `, `
        <button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
        <button class="btn btn-primary" onclick="App.closeModal();App.navigate('products');Sections.openProductForm({barcode:'${App.escape(barcode)}'})">➕ Crea Prodotto</button>
      `);
    }
  },

  // ── OUTBOUND CART ACTIONS ──
  addToOutboundCart(product) {
    const existing = outboundCart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.qty < product.qty) {
        existing.qty++;
      } else {
        App.toast(`Disponibilità massima raggiunta (${product.qty} pz) per ${product.name}`, 'warning');
      }
    } else {
      if (product.qty > 0) {
        outboundCart.push({ product, qty: 1 });
      } else {
        App.toast(`Prodotto ${product.name} non disponibile in magazzino (Giacenza: 0)`, 'error');
      }
    }
    this.renderOutbound();
  },
  updateOutboundQty(productId, qty) {
    const item = outboundCart.find(i => i.product.id === productId);
    if (item) {
      const newQty = Math.max(1, parseInt(qty) || 1);
      if (newQty <= item.product.qty) {
        item.qty = newQty;
      } else {
        App.toast(`Disponibilità massima raggiunta (${item.product.qty} pz)`, 'warning');
        item.qty = item.product.qty;
      }
    }
    this.renderOutbound();
  },
  removeFromOutboundCart(productId) {
    outboundCart = outboundCart.filter(i => i.product.id !== productId);
    this.renderOutbound();
  },
  clearOutboundCart() {
    outboundCart = [];
    this.renderOutbound();
  },
  handleOutboundBarcode(barcode) {
    const p = DB.Products.findByCode(barcode);
    if (p) {
      this.addToOutboundCart(p);
      App.toast(`➖ ${p.name} aggiunto alla lista`, 'success');
    } else {
      App.toast(`⚠ Barcode non registrato: ${barcode}`, 'warning');
      App.openModal('Prodotto Non Trovato', `
        <p style="color:var(--text2)">Nessun prodotto trovato con codice/barcode <b>${App.escape(barcode)}</b>.</p>
        <p style="color:var(--text2);margin-top:8px">Vuoi registrarlo come nuovo prodotto?</p>
      `, `
        <button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
        <button class="btn btn-primary" onclick="App.closeModal();App.navigate('products');Sections.openProductForm({barcode:'${App.escape(barcode)}'})">➕ Crea Prodotto</button>
      `);
    }
  },

  // ── INBOUND VIEW ──
  renderInbound() {
    const el = document.getElementById('section-inbound');
    el.innerHTML = `
<div class="page-header">
  <h1>Entrata Merci</h1>
  <div class="actions">
    <button class="btn btn-ghost" onclick="window.open(window.location.pathname + '?view=inbound&standalone=true', '_blank')">🔌 Apri in nuova scheda</button>
  </div>
</div>
<div class="grid-2">
  <div class="card">
    <div class="card-header"><span class="card-title">📥 Registra Carico Cumulativo</span></div>
    
    <div class="form-group" style="position:relative">
      <label><b>Cerca o Scansiona Prodotto</b></label>
      <input type="text" id="ib-search-input" placeholder="Scansiona barcode o digita nome, marca, modello..." 
        oninput="Sections.searchInboundProd(this.value)" onkeydown="if(event.key==='Enter'){Sections.handleInboundBarcode(this.value);this.value='';document.getElementById('ib-search-results').classList.add('hidden');}" autocomplete="off" class="form-control" style="width:100%"/>
      <div id="ib-search-results" class="search-results hidden" style="position:absolute; width:100%; z-index:100; max-height:200px; overflow-y:auto; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm)"></div>
    </div>

    <div class="table-wrap" style="margin-top:16px; margin-bottom:16px">
      <table style="width:100%">
        <thead>
          <tr>
            <th>Codice / EAN</th>
            <th>Prodotto</th>
            <th>Marca</th>
            <th style="width:120px">Quantità</th>
            <th>Azione</th>
          </tr>
        </thead>
        <tbody id="ib-cart-tbody">
          ${inboundCart.map(item => `
            <tr>
              <td><div class="td-code">${item.product.code}</div><div class="td-code" style="font-size:.7rem;color:var(--text3)">${item.product.barcode || ''}</div></td>
              <td style="font-weight:600">${App.escape(item.product.name)}</td>
              <td>${App.escape(item.product.brand || '—')}</td>
              <td>
                <div style="display:flex;align-items:center;gap:4px">
                  <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="Sections.updateInboundQty(${item.product.id}, ${item.qty - 1})">-</button>
                  <input type="number" min="1" value="${item.qty}" onchange="Sections.updateInboundQty(${item.product.id}, this.value)" style="width:50px;text-align:center;padding:4px;border-radius:var(--radius-xs);border:1px solid var(--border)"/>
                  <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="Sections.updateInboundQty(${item.product.id}, ${item.qty + 1})">+</button>
                </div>
              </td>
              <td>
                <button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.removeFromInboundCart(${item.product.id})">🗑️</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">La lista è vuota. Scansiona o cerca prodotti per aggiungerli.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="form-grid">
      <div class="form-group"><label>Data Entrata</label><input id="ib-date" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>
    </div>

    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-success" onclick="Sections.saveCumulativeInbound()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Registra Entrata (${inboundCart.reduce((s,i)=>s+i.qty, 0)} pz)
      </button>
      <button class="btn btn-ghost" onclick="Sections.clearInboundCart()">Svuota lista</button>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><span class="card-title">🕐 Ultime Entrate</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Data</th><th>Prodotto</th><th>Qty</th><th>Marca</th></tr></thead>
      <tbody>${DB.Movements.filter({type:'in'}).slice(0,10).map(m=>`<tr>
        <td style="font-size:.8rem">${App.fmtDate(m.date)}</td>
        <td><div style="font-weight:600;font-size:.85rem">${App.escape(m.productName)}</div></td>
        <td><span class="badge badge-green">+${m.qty}</span></td>
        <td style="font-size:.82rem">${App.escape(m.brand || '—')}</td>
      </tr>`).join('') || '<tr><td colspan="4"><div class="empty-state" style="padding:20px"><p>Nessuna entrata</p></div></td></tr>'}
      </tbody>
    </table></div>
  </div>
</div>`;
  },

  searchInboundProd(q) {
    const resultsPanel = document.getElementById('ib-search-results');
    if (!q || q.trim().length < 2) {
      resultsPanel.classList.add('hidden');
      return;
    }
    const matches = DB.Products.search(q).slice(0, 5);
    if (!matches.length) {
      resultsPanel.innerHTML = '<div style="padding:10px;color:var(--text3);font-size:.8rem">Nessun prodotto trovato</div>';
      resultsPanel.classList.remove('hidden');
      return;
    }
    resultsPanel.innerHTML = matches.map(p => `
      <div class="search-result-item" style="padding:8px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:between;align-items:center" onclick="Sections.selectInboundSearchProd(${p.id})">
        <div>
          <b style="font-size:.85rem">${App.escape(p.name)}</b>
          <div style="font-size:.7rem;color:var(--text3)">EAN: ${p.barcode || '—'} | Marca: ${p.brand || '—'}</div>
        </div>
        <span class="badge badge-gray" style="margin-left:auto">${p.qty} pz</span>
      </div>
    `).join('');
    resultsPanel.classList.remove('hidden');
  },

  selectInboundSearchProd(id) {
    const p = DB.Products.find(id);
    if (p) {
      this.addToInboundCart(p);
      document.getElementById('ib-search-input').value = '';
      document.getElementById('ib-search-results').classList.add('hidden');
      document.getElementById('ib-search-input').focus();
    }
  },

  saveCumulativeInbound() {
    if (!inboundCart.length) { App.toast('Aggiungi almeno un prodotto alla lista', 'error'); return; }
    const dateVal = document.getElementById('ib-date').value;
    const operator = App.getUser()?.name || 'admin';

    inboundCart.forEach(item => {
      DB.Movements.create({
        type: 'in',
        productId: item.product.id,
        productCode: item.product.code,
        productName: item.product.name,
        qty: item.qty,
        brand: item.product.brand || '',
        model: item.product.model || '',
        date: dateVal,
        operator: operator
      });
      DB.Products.updateQty(item.product.id, item.qty);
    });

    App.toast(`Carico di ${inboundCart.reduce((s,i)=>s+i.qty, 0)} pezzi registrato con successo`, 'success');
    inboundCart = [];
    App.updateNotifications();
    this.renderInbound();
  },

  // ── OUTBOUND VIEW ──
  renderOutbound() {
    const el = document.getElementById('section-outbound');
    el.innerHTML = `
<div class="page-header">
  <h1>Uscita Merci</h1>
  <div class="actions">
    <button class="btn btn-ghost" onclick="window.open(window.location.pathname + '?view=outbound&standalone=true', '_blank')">🔌 Apri in nuova scheda</button>
  </div>
</div>
<div class="grid-2">
  <div class="card">
    <div class="card-header"><span class="card-title">📤 Registra Scarico Cumulativo</span></div>
    
    <div class="form-group" style="position:relative">
      <label><b>Cerca o Scansiona Prodotto</b></label>
      <input type="text" id="ob-search-input" placeholder="Scansiona barcode o digita nome, marca, modello..." 
        oninput="Sections.searchOutboundProd(this.value)" onkeydown="if(event.key==='Enter'){Sections.handleOutboundBarcode(this.value);this.value='';document.getElementById('ob-search-results').classList.add('hidden');}" autocomplete="off" class="form-control" style="width:100%"/>
      <div id="ob-search-results" class="search-results hidden" style="position:absolute; width:100%; z-index:100; max-height:200px; overflow-y:auto; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm)"></div>
    </div>

    <div class="table-wrap" style="margin-top:16px; margin-bottom:16px">
      <table style="width:100%">
        <thead>
          <tr>
            <th>Codice / EAN</th>
            <th>Prodotto</th>
            <th>Marca</th>
            <th style="width:120px">Quantità</th>
            <th>Azione</th>
          </tr>
        </thead>
        <tbody id="ob-cart-tbody">
          ${outboundCart.map(item => `
            <tr>
              <td><div class="td-code">${item.product.code}</div><div class="td-code" style="font-size:.7rem;color:var(--text3)">${item.product.barcode || ''}</div></td>
              <td style="font-weight:600">${App.escape(item.product.name)}</td>
              <td>${App.escape(item.product.brand || '—')}</td>
              <td>
                <div style="display:flex;align-items:center;gap:4px">
                  <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="Sections.updateOutboundQty(${item.product.id}, ${item.qty - 1})">-</button>
                  <input type="number" min="1" max="${item.product.qty}" value="${item.qty}" onchange="Sections.updateOutboundQty(${item.product.id}, this.value)" style="width:50px;text-align:center;padding:4px;border-radius:var(--radius-xs);border:1px solid var(--border)"/>
                  <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="Sections.updateOutboundQty(${item.product.id}, ${item.qty + 1})">+</button>
                </div>
              </td>
              <td>
                <button class="btn btn-ghost btn-sm btn-icon" onclick="Sections.removeFromOutboundCart(${item.product.id})">🗑️</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">La lista è vuota. Scansiona o cerca prodotti per aggiungerli.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="form-grid">
      <div class="form-group"><label>Data Uscita</label><input id="ob-date" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>
      <div class="form-group"><label>Cliente / Destinazione</label><input id="ob-customer" placeholder="Cliente o destinazione"/></div>
    </div>

    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-danger" onclick="Sections.saveCumulativeOutbound()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Registra Uscita (${outboundCart.reduce((s,i)=>s+i.qty, 0)} pz)
      </button>
      <button class="btn btn-ghost" onclick="Sections.clearOutboundCart()">Svuota lista</button>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><span class="card-title">🕐 Ultime Uscite</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Data</th><th>Prodotto</th><th>Qty</th><th>Destinatario</th></tr></thead>
      <tbody>${DB.Movements.filter({type:'out'}).slice(0,10).map(m=>`<tr>
        <td style="font-size:.8rem">${App.fmtDate(m.date)}</td>
        <td><div style="font-weight:600;font-size:.85rem">${App.escape(m.productName)}</div></td>
        <td><span class="badge badge-red">-${m.qty}</span></td>
        <td style="font-size:.82rem">${App.escape(m.customer || '—')}</td>
      </tr>`).join('') || '<tr><td colspan="4"><div class="empty-state" style="padding:20px"><p>Nessuna uscita</p></div></td></tr>'}
      </tbody>
    </table></div>
  </div>
</div>`;
  },

  searchOutboundProd(q) {
    const resultsPanel = document.getElementById('ob-search-results');
    if (!q || q.trim().length < 2) {
      resultsPanel.classList.add('hidden');
      return;
    }
    const matches = DB.Products.search(q).slice(0, 5);
    if (!matches.length) {
      resultsPanel.innerHTML = '<div style="padding:10px;color:var(--text3);font-size:.8rem">Nessun prodotto trovato</div>';
      resultsPanel.classList.remove('hidden');
      return;
    }
    resultsPanel.innerHTML = matches.map(p => `
      <div class="search-result-item" style="padding:8px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:between;align-items:center" onclick="Sections.selectOutboundSearchProd(${p.id})">
        <div>
          <b style="font-size:.85rem">${App.escape(p.name)}</b>
          <div style="font-size:.7rem;color:var(--text3)">EAN: ${p.barcode || '—'} | Giacenza: ${p.qty} pz</div>
        </div>
        <span class="badge ${p.qty===0?'badge-red':p.qty<=p.qtyMin?'badge-yellow':'badge-green'}" style="margin-left:auto">${p.qty} pz</span>
      </div>
    `).join('');
    resultsPanel.classList.remove('hidden');
  },

  selectOutboundSearchProd(id) {
    const p = DB.Products.find(id);
    if (p) {
      this.addToOutboundCart(p);
      document.getElementById('ob-search-input').value = '';
      document.getElementById('ob-search-results').classList.add('hidden');
      document.getElementById('ob-search-input').focus();
    }
  },

  saveCumulativeOutbound() {
    if (!outboundCart.length) { App.toast('Aggiungi almeno un prodotto alla lista', 'error'); return; }
    
    // Validate quantities against actual stock first
    for (let item of outboundCart) {
      const dbProd = DB.Products.find(item.product.id);
      if (!dbProd || dbProd.qty < item.qty) {
        App.toast(`Giacenza insufficiente per "${item.product.name}"! Disponibili: ${dbProd ? dbProd.qty : 0} pz`, 'error');
        return;
      }
    }

    const dateVal = document.getElementById('ob-date').value;
    const customerVal = document.getElementById('ob-customer').value;
    const operator = App.getUser()?.name || 'admin';

    outboundCart.forEach(item => {
      DB.Movements.create({
        type: 'out',
        productId: item.product.id,
        productCode: item.product.code,
        productName: item.product.name,
        qty: item.qty,
        brand: item.product.brand || '',
        model: item.product.model || '',
        date: dateVal,
        customer: customerVal,
        operator: operator
      });
      DB.Products.updateQty(item.product.id, -item.qty);
    });

    App.toast(`Scarico di ${outboundCart.reduce((s,i)=>s+i.qty, 0)} pezzi registrato con successo`, 'success');
    outboundCart = [];
    App.updateNotifications();
    this.renderOutbound();
  },

  // ── MOVEMENTS VIEW WITH SORTING ──
  renderMovements() {
    const el = document.getElementById('section-movements');
    const filt = window._movFilt || { type:'', q:'', from:'', to:'', sortKey:'date', sortOrder:'desc' };
    window._movFilt = filt;
    const moves = DB.Movements.filter(filt);

    // Apply sorting to movements list
    if (filt.sortKey) {
      moves.sort((a, b) => {
        let valA = a[filt.sortKey] || '';
        let valB = b[filt.sortKey] || '';
        if (filt.sortKey === 'brand') {
          valA = (a.brand || '').toLowerCase();
          valB = (b.brand || '').toLowerCase();
        }
        if (typeof valA === 'string') {
          return filt.sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return filt.sortOrder === 'asc' ? valA - valB : valB - valA;
        }
      });
    }

    const arrow = (k) => {
      if (filt.sortKey !== k) return '<span style="color:var(--text3);font-size:.7rem">⇅</span>';
      return filt.sortOrder === 'asc' ? '▲' : '▼';
    };

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
  <input type="text" placeholder="🔍 Filtra per prodotto, codice, brand..." value="${filt.q}"
    oninput="window._movFilt.q=this.value;Sections.renderMovements()" style="flex:1"/>
  <label style="font-size:.82rem;color:var(--text2)">Dal</label>
  <input type="date" value="${filt.from}" onchange="window._movFilt.from=this.value;Sections.renderMovements()"/>
  <label style="font-size:.82rem;color:var(--text2)">Al</label>
  <input type="date" value="${filt.to}" onchange="window._movFilt.to=this.value;Sections.renderMovements()"/>
  <button class="btn btn-ghost btn-sm" onclick="window._movFilt={type:'',q:'',from:'',to:'',sortKey:'date',sortOrder:'desc'};Sections.renderMovements()">Reset</button>
</div>
<div class="table-wrap"><table>
<thead><tr>
  <th>Tipo</th>
  <th style="cursor:pointer" onclick="Sections.toggleMovSort('date')">Data ${arrow('date')}</th>
  <th>Prodotto</th>
  <th>Codice</th>
  <th style="cursor:pointer" onclick="Sections.toggleMovSort('brand')">Marca ${arrow('brand')}</th>
  <th>Modello</th>
  <th>Qty</th>
  <th>Operatore</th>
</tr></thead>
<tbody>${moves.length ? moves.map(m=>`<tr>
  <td><span class="badge ${m.type==='in'?'badge-green':'badge-red'}">${m.type==='in'?'📥 Entrata':'📤 Uscita'}</span></td>
  <td style="font-size:.82rem;white-space:nowrap">${App.fmtDate(m.date)}</td>
  <td style="font-weight:600;font-size:.87rem">${App.escape(m.productName)}</td>
  <td class="td-code">${App.escape(m.productCode || '')}</td>
  <td>${App.escape(m.brand || '—')}</td>
  <td>${App.escape(m.model || '—')}</td>
  <td><span class="badge ${m.type==='in'?'badge-green':'badge-red'}">${m.type==='in'?'+':'-'}${m.qty}</span></td>
  <td style="font-size:.8rem">${App.escape(m.operator || '')}</td>
</tr>`).join('') : '<tr><td colspan="8"><div class="empty-state" style="padding:30px"><div class="es-icon">📋</div><h3>Nessun movimento trovato</h3></div></td></tr>'}
</tbody></table></div>`;
  },

  toggleMovSort(key) {
    const filt = window._movFilt || { type:'', q:'', from:'', to:'', sortKey:'date', sortOrder:'desc' };
    if (filt.sortKey === key) {
      filt.sortOrder = filt.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      filt.sortKey = key;
      filt.sortOrder = 'asc';
    }
    window._movFilt = filt;
    this.renderMovements();
  },

  _exportMovements() {
    const filt = window._movFilt || {};
    const moves = DB.Movements.filter(filt);
    const h = ['tipo','data','prodotto','codice','marca','modello','quantita','operatore'];
    const rows = moves.map(m=>[m.type==='in'?'Entrata':'Uscita',m.date,m.productName,m.productCode||'',m.brand||'',m.model||'',m.qty,m.operator||''].map(v=>`"${v}"`).join(','));
    const csv = [h.join(','),...rows].join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `movimenti_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    App.toast('Esportazione movimenti completata','success');
  }
});
