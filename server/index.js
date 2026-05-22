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
app.use(bodyParser.json());

// Serve i file statici della UI (public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

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
