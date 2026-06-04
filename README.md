# AgaveWMS – Gestionale Magazzino

Software gestionale moderno, performante e reattivo per la gestione del magazzino aziendale (entrata/uscita merci, storico movimenti, reportistica, gestione anagrafica prodotti e importazione massiva da CSV).

## Caratteristiche Principali

- **Dashboard Real-Time**: Indicatori di stato (quantità totali, valore economico, prodotti sotto scorta) e grafici dinamici mensili e per categoria.
- **Anagrafica Prodotti Completa**: Gestione codice, barcode (EAN), categoria, marca, quantità minime, prezzi di acquisto e vendita, ubicazione, fornitore e note.
- **Carico/Scarico Merci**: Entrata ed uscita merci semplificate, con ricalcolo automatico della disponibilità, controllo scorte minime e alert preventivi.
- **Movimenti & Storico**: Report dettagliato dei movimenti di magazzino filtrabile per tipo, data, prodotto, con possibilità di esportazione CSV.
- **Importazione CSV Massiva**: Drag & drop di file CSV, auto-rilevamento delimitatore, mappatura flessibile delle colonne, validazione errori in tempo reale.
- **Sistema Utenti & Permessi**: 4 livelli di ruolo (Admin, Magazziniere, Operatore, Visualizzatore) con permessi granulari.
- **Design Moderno**: Interfaccia reattiva con supporto tema chiaro/scuro nativo e zero dipendenze esterne.

## Struttura File

- `index.html`: Struttura e layout dell'applicazione (WMS Shell).
- `css/style.css`: Design System completo (variabili CSS, utility, layout e componenti).
- `js/db.js`: Database layer e logica persistente (LocalStorage).
- `js/charts.js`: Motore grafico canvas nativo (Bar, Donut, Sparkline).
- `js/app.js`: Controller principale, autenticazione, routing e UI utils.
- `js/sections.js`: Sezione Dashboard e Prodotti (CRUD).
- `js/sections2.js`: Sezione Carico (Inbound), Scarico (Outbound) e Movimenti.
- `js/sections3.js`: Sezione Import CSV, Analytics (Report) e Impostazioni.

# Avvio Locale

```bash
# Install server dependencies
npm install

# Avvia il server Express (ascolta su http://localhost:3000)
node server/index.js
```

Poi apri il browser all'indirizzo `http://localhost:3000`.

**Credenziali demo**:
- **Admin**: `admin` / `admin`
- **Magazziniere**: `magazziniere` / `1234`
- **Operatore**: `operatore` / `1234`
