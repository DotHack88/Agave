// api/backup.js
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { join, resolve } from 'path';
import archiver from 'archiver';

// Vercel passes the context with req/res
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // ----------- 1️⃣ Crea cartella temporanea ----------
  const tmpRoot = '/tmp';
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '');
  const backupFolder = join(tmpRoot, `backup_${timestamp}`);

  await fs.mkdir(backupFolder, { recursive: true });

  // ----------- 2️⃣ Copia i file della tua app ----------
  // Copiamo tutto dalla radice del progetto (esclusi node_modules, .git, ecc.)
  const srcRoot = resolve(process.cwd(), '..'); // directory radice del repo (una sopra la cartella api)
  // Funzione ricorsiva di copia (esempio semplice)
  async function copyRecursive(src, dest) {
    const entries = await fs.readdir(src, { withFileTypes: true });
    await fs.mkdir(dest, { recursive: true });
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        if ([
          'node_modules',
          '.git',
          '.vercel',
          'backup_temp'
        ].includes(entry.name)) continue;
        await copyRecursive(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
  await copyRecursive(srcRoot, backupFolder);

  // ----------- 3️⃣ Crea il file ZIP ----------
  const zipPath = join(tmpRoot, `agave_backup_${timestamp}.zip`);
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  // Gestione errori
  archive.on('error', err => {
    console.error('Archiver error:', err);
    res.status(500).end();
  });

  // Quando lo ZIP è pronto, lo inviamo al client
  output.on('close', async () => {
    // ------- 4️⃣ Invia il file al client -------
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${zipPath.split('/').pop()}`);
    const readStream = createReadStream(zipPath);
    readStream.pipe(res);
    // (Opzionale) cancellazione dei file temporanei
    await fs.rm(backupFolder, { recursive: true, force: true });
    await fs.rm(zipPath, { force: true });
  });

  // Avvia lo zip
  archive.pipe(output);
  archive.directory(backupFolder, false);
  await archive.finalize();
}
