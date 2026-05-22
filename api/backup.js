// api/backup.js
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { join, resolve } from 'path';
import archiver from 'archiver';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // ----------- 1. Cartella temporanea -----------
  const tmpRoot = '/tmp';
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '');
  const backupFolder = join(tmpRoot, `backup_${timestamp}`);
  await fs.mkdir(backupFolder, { recursive: true });

  // ----------- 2. Copia i file del progetto Agave -----------
  // process.cwd() è già la root del progetto (C:\Users\Emanuele\Agave)
  const srcRoot = resolve(process.cwd());

  // Cartelle da escludere
  const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    '.vercel',
    '.next',
    'backup_temp',
    'tmp',
    '.gemini'
  ]);

  async function copyRecursive(src, dest) {
    let entries;
    try {
      entries = await fs.readdir(src, { withFileTypes: true });
    } catch {
      return; // cartella non leggibile, salta
    }
    await fs.mkdir(dest, { recursive: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await copyRecursive(srcPath, destPath);
      } else {
        try {
          await fs.copyFile(srcPath, destPath);
        } catch {
          // File bloccato o non copiabile — salta senza bloccare tutto
          console.warn(`Skipped (locked/busy): ${srcPath}`);
        }
      }
    }
  }

  await copyRecursive(srcRoot, backupFolder);

  // ----------- 3. Crea lo ZIP -----------
  const zipPath = join(tmpRoot, `agave_backup_${timestamp}.zip`);
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', err => {
    console.error('Archiver error:', err);
    if (!res.headersSent) res.status(500).end();
  });

  output.on('close', async () => {
    // ----------- 4. Invia ZIP al client -----------
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=agave_backup_${timestamp}.zip`);
    const readStream = createReadStream(zipPath);
    readStream.pipe(res);

    // Pulizia file temporanei
    try {
      await fs.rm(backupFolder, { recursive: true, force: true });
      await fs.rm(zipPath, { force: true });
    } catch {
      // ignora errori di pulizia
    }
  });

  archive.pipe(output);
  archive.directory(backupFolder, false);
  await archive.finalize();
}
