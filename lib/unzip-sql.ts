import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

// Extract the single .sql entry from a ZIP archive (the committed WordPress
// dump) without an unzip binary — Vercel's runtime image has none. Minimal,
// purpose-built reader: End-of-Central-Directory → central directory → the
// first *.sql entry (skipping __MACOSX resource forks) → streamed inflate to
// `destPath`. No ZIP64 (the dump is 16 MB compressed / ~100 MB inflated).

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export async function extractSqlFromZip(zipPath: string, destPath: string): Promise<{ name: string; bytes: number }> {
  const fd = fs.openSync(zipPath, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    // EOCD lives in the last 22..(22+65535) bytes; scan backwards for its signature.
    const tailLen = Math.min(size, 22 + 65536);
    const tail = Buffer.alloc(tailLen);
    fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a ZIP file (no end-of-central-directory).');
    const cdCount = tail.readUInt16LE(eocd + 10);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);

    const cd = Buffer.alloc(cdSize);
    fs.readSync(fd, cd, 0, cdSize, cdOffset);

    // Walk central directory entries for the first usable .sql file.
    let p = 0;
    for (let n = 0; n < cdCount && p + 46 <= cd.length; n++) {
      if (cd.readUInt32LE(p) !== CEN_SIG) throw new Error('Corrupt central directory.');
      const method = cd.readUInt16LE(p + 10);
      const compSize = cd.readUInt32LE(p + 20);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const localOffset = cd.readUInt32LE(p + 42);
      const name = cd.toString('utf8', p + 46, p + 46 + nameLen);
      p += 46 + nameLen + extraLen + commentLen;

      if (!name.toLowerCase().endsWith('.sql') || name.includes('__MACOSX') || path.basename(name).startsWith('.')) continue;

      // Local header tells us where the compressed bytes actually start.
      const loc = Buffer.alloc(30);
      fs.readSync(fd, loc, 0, 30, localOffset);
      if (loc.readUInt32LE(0) !== LOC_SIG) throw new Error('Corrupt local file header.');
      const dataStart = localOffset + 30 + loc.readUInt16LE(26) + loc.readUInt16LE(28);

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const src = fs.createReadStream(zipPath, { start: dataStart, end: dataStart + compSize - 1 });
      const out = fs.createWriteStream(destPath);
      if (method === 8) await pipeline(src, zlib.createInflateRaw(), out);
      else if (method === 0) await pipeline(src, out);
      else throw new Error(`Unsupported compression method ${method}.`);
      return { name, bytes: fs.statSync(destPath).size };
    }
    throw new Error('No .sql entry found in the archive.');
  } finally {
    fs.closeSync(fd);
  }
}
