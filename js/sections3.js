/* AgaveWMS – Sections 3: CSV, Reports, Settings */

Object.assign(Sections, {

  renderCSV() {
    const el = document.getElementById('section-csv');
    if (!el) return;
    
    el.innerHTML = `
      <div class="page-header">
        <h1>Importazione CSV</h1>
        <div class="actions">
          <button class="btn btn-ghost" onclick="Sections._downloadCSVTemplate()">⬇ Scarica Template CSV</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">📂 Carica File CSV</span></div>
          <div class="dropzone" id="csv-dropzone" onclick="document.getElementById('csv-file-input').click()"
            ondragover="event.preventDefault();this.classList.add('drag-over')"
            ondragleave="this.classList.remove('drag-over')"
            ondrop="event.preventDefault();this.classList.remove('drag-over');Sections._handleCSVDrop(event)">
            <div class="dropzone-icon">📄</div>
            <h3>Trascina il file CSV qui</h3>
            <p>oppure clicca per selezionarlo dal computer</p>
            <p style="margin-top:8px;font-size:.78rem;color:var(--text3)">Formato supportato: CSV, UTF-8, separatore virgola o punto e virgola</p>
            <input type="file" id="csv-file-input" accept=".csv,.txt" onchange="Sections._handleCSVFile(this)" style="display:none;" />
          </div>
          <div style="margin-top:16px">
            <label class="form-group"><label>Separatore colonne</label>
              <select id="csv-delimiter">
                <option value=",">Virgola (,)</option>
                <option value=";">Punto e virgola (;)</option>
                <option value="\t">Tab</option>
              </select>
            </label>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">ℹ️ Colonne supportate</span></div>
          <div style="font-size:.83rem;line-height:2">
            <table style="width:100%">
              <thead>
                <tr><th>Colonna CSV</th><th>Campo</th></tr>
              </thead>
              <tbody>
                ${[
                  ['codice / product_code','Codice prodotto'],
                  ['barcode / ean','Barcode EAN'],
                  ['nome / name / prodotto','Nome prodotto'],
                  ['categoria / category','Categoria'],
                  ['marca / brand','Marca'],
                  ['quantita / quantity / qty','Quantità'],
                  ['quantita_minima / qty_min','Scorta minima'],
                  ['prezzo_acquisto / costo','Prezzo acquisto'],
                  ['prezzo_vendita / prezzo','Prezzo vendita'],
                  ['fornitore / supplier','Fornitore'],
                  ['ubicazione / location','Ubicazione']
                ].map(([col,field])=>
                  `<tr><td class="td-code" style="font-size:.78rem">${col}</td><td>${field}</td></tr>`
                ).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="csv-preview-area"></div>`;
  },

  _downloadCSVTemplate() {
    const csv = DB.CSV.template();
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='template_prodotti.csv'; a.click();
    App.toast('Template scaricato','success');
  },

  _handleCSVFile(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => Sections._parseAndPreviewCSV(e.target.result);
    reader.readAsText(file, 'UTF-8');
  },

  _handleCSVDrop(e) {
    const file = e.dataTransfer.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => Sections._parseAndPreviewCSV(ev.target.result);
    reader.readAsText(file, 'UTF-8');
  },

  _parseAndPreviewCSV(text) {
    const delim = document.getElementById('csv-delimiter').value;
    const { headers, rows } = DB.CSV.parse(text, delim);
    const area = document.getElementById('csv-preview-area');
    if (!rows.length) { area.innerHTML='<div class="card" style="margin-top:16px"><p style="color:var(--red)">File vuoto o non valido</p></div>'; return; }
    const preview = rows.slice(0,5);
    area.innerHTML = `
      <div class="card" style="margin-top:16px">
        <div class="card-header">
          <span class="card-title">👁 Anteprima (${rows.length} righe trovate)</span>
          <button class="btn btn-primary" onclick="Sections._importCSV(${JSON.stringify(rows).replace(/"/g,'&quot;')})">
            ✅ Importa ${rows.length} prodotti
          </button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${preview.map(r=>`<tr>${headers.map(h=>`<td style="font-size:.82rem">${App.escape(r[h]||'')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        ${rows.length>5?`<p style="padding:10px;color:var(--text2);font-size:.82rem">...e altre ${rows.length-5} righe</p>`:''}
      </div>`;
  },

  _importCSV(rows) {
    const results = DB.CSV.import(rows, App.getUser()?.name||'admin');
    const area = document.getElementById('csv-preview-area');
    App.updateNotifications();
    let html = `<div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title">📊 Risultato Importazione</span></div>
      <div class="stats-grid" style="margin-bottom:${results.errors.length?'16px':'0'}">
        <div class="stat-card">
          <div class="stat-icon green">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="stat-info"><div class="stat-value">${results.created}</div><div class="stat-label">Nuovi prodotti</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/></svg>
          </div>
          <div class="stat-info"><div class="stat-value">${results.updated}</div><div class="stat-label">Aggiornati</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="stat-info"><div class="stat-value">${results.errors.length}</div><div class="stat-label">Errori</div></div>
        </div>
      </div>`;
    if (results.errors.length) {
      html += `<div style="margin-top:8px"><h4 style="margin-bottom:8px;color:var(--red)">Errori rilevati:</h4>
        ${results.errors.slice(0,10).map(e=>`<div style="background:var(--red-soft);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:6px;font-size:.82rem"><b>Riga ${e.row}:</b> ${e.errors.join(', ')}</div>`).join('')}
      </div>`;
    }
    html += '</div>';
    area.innerHTML = html;
    App.toast(`Importazione: ${results.created} creati, ${results.updated} aggiornati, ${results.errors.length} errori`, results.errors.length?'warning':'success');
  },

  renderReports() {
    const el = document.getElementById('section-reports');
    if (!el) return;
    const prods = DB.Products.active();
    const low = DB.Products.lowStock();
    const topMoved = DB.Movements.byProduct().slice(0,5);

    el.innerHTML = `
      <div class="page-header"><h1>Report & Statistiche</h1>
        <div class="actions"><button class="btn btn-ghost" onclick="DB.Backup.export()">💾 Backup Dati</button></div>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">🏆 Prodotti più movimentati</span></div>
          <div class="table-wrap"><table>
            <thead><tr><th>#</th><th>Prodotto</th><th>Entrate</th><th>Uscite</th><th>Totale</th></tr></thead>
            <tbody>${topMoved.map((p,i)=>`<tr>
              <td><span class="badge badge-primary">${i+1}</span></td>
              <td style="font-weight:600;font-size:.87rem">${App.escape(p.name)}</td>
              <td><span class="badge badge-green">+${p.in}</span></td>
              <td><span class="badge badge-red">-${p.out}</span></td>
              <td><b>${p.in+p.out}</b></td>
            </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text2)">Nessun dato</td></tr>'}
            </tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">⚠️ Prodotti sotto scorta</span></div>
          ${low.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Prodotto</th><th>Disponibile</th><th>Minimo</th><th>Stato</th></tr></thead>
            <tbody>${low.map(p=>`<tr>
              <td style="font-weight:600;font-size:.87rem">${App.escape(p.name)}</td>
              <td><span class="badge ${p.qty===0?'badge-red':'badge-yellow'}">${p.qty}</span></td>
              <td>${p.qtyMin}</td>
              <td><span class="badge ${p.qty===0?'badge-red':'badge-yellow'}">${p.qty===0?'ESAURITO':'Bassa'}</span></td>
            </tr>`).join('')}
            </tbody>
          </table></div>` : '<div class="empty-state" style="padding:30px"><div class="es-icon">✅</div><h3>Tutte le scorte OK</h3></div>'}
        </div>
      </div>`;
  },

  renderSettings() {
    const el = document.getElementById('section-settings');
    if (!el) return;
    const s = DB.Settings.get();
    const users = DB.Users.all();
    const canDel = DB.Users.canDelete(App.getUser());
    el.innerHTML = `
      <div class="page-header"><h1>Impostazioni</h1></div>
      <div class="grid-2">
      <div>
        <div class="card" style="margin-bottom:16px">
          <div class="settings-section">
            <h3>Azienda</h3>
            <div class="form-group"><label>Nome Azienda</label><input id="s-company" value="${App.escape(s.company||'')}" onchange="Sections._saveSetting('company',this.value)"/></div>
            <div class="form-group"><label>Valuta</label>
              <select id="s-currency" onchange="Sections._saveSetting('currency',this.value)">
                <option value="EUR" ${s.currency==='EUR'?'selected':''}>Euro (€)</option>
                <option value="USD" ${s.currency==='USD'?'selected':''}>Dollaro ($)</option>
                <option value="GBP" ${s.currency==='GBP'?'selected':''}>Sterlina (£)</option>
              </select>
            </div>
          </div>
          <div class="settings-section">
            <h3>Interfaccia</h3>
            <div class="settings-row">
              <div><div class="settings-label">Tema scuro</div><div class="settings-sub">Cambia l'aspetto dell'interfaccia</div></div>
              <label class="toggle"><input type="checkbox" ${document.body.classList.contains('dark')?'checked':''} onchange="App.toggleTheme()"/><span class="toggle-slider"></span></label>
            </div>
            <div class="settings-row">
              <div>
                <div class="settings-label">Avvisi scorte basse</div>
                <div class="settings-sub">Mostra/nasconde il widget "Scorte" nel Dashboard con i prodotti in esaurimento.</div>
              </div>
              <label class="toggle"><input type="checkbox" ${s.lowStockAlert?'checked':''} onchange="Sections._saveSetting('lowStockAlert',this.checked)"/><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div class="settings-section">
            <h3>Backup Dati</h3>
            <div class="settings-row">
              <div><div class="settings-label">Cartella di Backup</div><div class="settings-sub" id="backup-folder-status">Percorso non impostato</div></div>
              <button class="btn btn-primary btn-sm" onclick="Sections._selectBackupFolder()">📁 Scegli Cartella</button>
            </div>
            <div class="settings-row">
              <div><div class="settings-label">Backup Manuale</div><div class="settings-sub">Salva i dati nella cartella scelta</div></div>
              <button class="btn btn-ghost btn-sm" onclick="Sections._forceBackup()">💾 Esegui Ora</button>
            </div>
            <div class="settings-row">
              <div><div class="settings-label">Importa Dati JSON</div><div class="settings-sub">Ripristina da un file di backup JSON</div></div>
              <label class="btn btn-ghost btn-sm" style="cursor:pointer">📂 Importa<input type="file" accept=".json" style="display:none" onchange="Sections._importBackup(this)"/></label>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="card">
          <div class="card-header"><span class="card-title">👥 Gestione Utenti</span>
            ${canDel?`<button class="btn btn-primary btn-sm" onclick="Sections._openUserForm()">+ Aggiungi</button>`:''}
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Utente</th><th>Nome</th><th>Ruolo</th><th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>${users.map(u=>`<tr>
              <td class="td-code">${App.escape(u.username)}</td>
              <td style="font-weight:600">${App.escape(u.name)}</td>
              <td><span class="badge badge-primary">${DB.Users.ROLES[u.role]||u.role}</span></td>
              <td><span class="badge ${u.active?'badge-green':'badge-gray'}">${u.active?'Attivo':'Disattivo'}</span></td>
              <td><div class="td-actions">
                ${canDel ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="Sections._openUserForm(${u.id})" title="Modifica">✏️</button>` : ''}
                ${canDel&&u.username!=='admin'?`<button class="btn btn-ghost btn-sm btn-icon" onclick="Sections._deleteUser(${u.id})" title="Elimina">🗑️</button>`:''}
              </div></td>
            </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      </div>
      </div>`;

    setTimeout(async () => {
      const handle = await DB.LocalBackup.getDirectoryHandle();
      const lbl = document.getElementById('backup-folder-status');
      if (lbl) {
        if (handle) {
          lbl.innerHTML = `<span style="color:var(--green)">✅ ${handle.name}</span><br>Backup automatico alle 19:00 attivo.`;
        } else {
          lbl.innerHTML = `<span style="color:var(--red)">⚠️ Nessuna cartella. Backup disattivato.</span>`;
        }
      }
    }, 50);
  },

  async _selectBackupFolder() {
    if (!window.showDirectoryPicker) {
      App.toast('Il tuo browser non supporta la selezione della cartella. Usa Chrome o Edge.', 'error');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker();
      await DB.LocalBackup.saveDirectoryHandle(handle);
      App.toast('Cartella di backup impostata con successo!', 'success');
      this.renderSettings();
    } catch (e) {
      App.toast('Selezione cartella annullata.', 'warning');
    }
  },

  async _forceBackup() {
    App.toast('Avvio backup in corso...', 'info');
    await DB.LocalBackup.executeBackup(false);
  },

  _saveSetting(key, val) {
    DB.Settings.set({[key]:val});
    if (key === 'lowStockAlert') {
      // Re-render dashboard so the Scorte widget appears/disappears immediately
      Sections.renderDashboard();
      App.toast(val
        ? 'Avvisi scorte basse abilitati – widget Scorte visibile nel Dashboard'
        : 'Avvisi scorte basse disabilitati – widget Scorte nascosto dal Dashboard', 'success');
    } else {
      App.toast('Impostazione salvata', 'success');
    }
  },

  _restoreAutoBackup() {
    App.confirm('Ripristinare l\'ultimo backup automatico? I dati attuali verranno sovrascritti.', () => {
      const ok = DB.Backup.restoreAutoBackup();
      if (ok) {
        App.toast('Database ripristinato con successo! Ricarica in corso...','success');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        App.toast('Nessun backup automatico disponibile','error');
      }
    });
  },

  _importBackup(input) {
    const file = input.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = e => {
      try { DB.Backup.import(e.target.result); App.toast('Backup ripristinato! Ricarica in corso...','success'); setTimeout(() => window.location.reload(), 1200); }
      catch { App.toast('File backup non valido','error'); }
    };
    r.readAsText(file);
  },

  _openUserForm(id = null) {
    let u = { username:'', password:'', name:'', role:'operator' };
    if (id) {
      const found = DB.Users.find(id);
      if (found) u = found;
    }
    App.openModal(id ? 'Modifica Utente' : 'Nuovo Utente', `
      <div class="form-group"><label>Username *</label><input id="uf-user" value="${App.escape(u.username)}" placeholder="username" ${id && u.username==='admin' ? 'disabled' : ''}/></div>
      <div class="form-group"><label>Password *</label><input id="uf-pass" value="${App.escape(u.password)}" type="password" placeholder="••••••"/></div>
      <div class="form-group"><label>Nome Completo *</label><input id="uf-name" value="${App.escape(u.name)}" placeholder="Nome Cognome"/></div>
      <div class="form-group"><label>Ruolo</label>
        <select id="uf-role" ${id && u.username==='admin' ? 'disabled' : ''}>
          <option value="operator" ${u.role==='operator'?'selected':''}>Operatore</option>
          <option value="warehouse" ${u.role==='warehouse'?'selected':''}>Magazziniere</option>
          <option value="viewer" ${u.role==='viewer'?'selected':''}>Visualizzatore</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
        </select>
      </div>`,
      `<button class="btn btn-ghost" onclick="App.closeModal()">Annulla</button>
       <button class="btn btn-primary" onclick="Sections._saveUser(${id ? `'${id}'` : 'null'})">Salva</button>`);
  },

  _saveUser(id = null) {
    const username = document.getElementById('uf-user').value.trim();
    const password = document.getElementById('uf-pass').value.trim();
    const name = document.getElementById('uf-name').value.trim();
    const role = document.getElementById('uf-role').value;
    if (!username||!password||!name) { App.toast('Compila tutti i campi','error'); return; }
    
    if (id) {
      DB.Users.update(id, { username, password, name, role });
      App.toast('Utente aggiornato','success');
    } else {
      DB.Users.create({ username, password, name, role });
      App.toast('Utente creato','success');
    }
    App.closeModal();
    Sections.renderSettings();
  },

  _deleteUser(id) {
    App.confirm('Eliminare questo utente?', () => {
      DB.Users.delete(id); App.toast('Utente eliminato','warning'); Sections.renderSettings();
    });
  }
});
