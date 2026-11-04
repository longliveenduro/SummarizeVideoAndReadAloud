import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

// CRC32 table & function
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Creates a standard ZIP buffer from a list of files
 * @param {{ path: string, data: Buffer }[]} files
 * @returns {Buffer}
 */
function createZip(files) {
  const localHeaders = [];
  const centralDirs = [];
  let offset = 0;

  for (const file of files) {
    const filenameBuf = Buffer.from(file.path.replace(/\\/g, '/'), 'utf8');
    const uncompressedData = file.data;
    const compressedData = zlib.deflateRawSync(uncompressedData);
    const useCompressed = compressedData.length < uncompressedData.length;
    const finalData = useCompressed ? compressedData : uncompressedData;
    const compressionMethod = useCompressed ? 8 : 0;
    const crc = crc32(uncompressedData);

    // Local file header
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed to extract
    localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(0, 10);         // Last mod file time
    localHeader.writeUInt16LE(0, 12);         // Last mod file date
    localHeader.writeUInt32LE(crc, 14);       // CRC32
    localHeader.writeUInt32LE(finalData.length, 18);        // Compressed size
    localHeader.writeUInt32LE(uncompressedData.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26);      // File name length
    localHeader.writeUInt16LE(0, 28);                       // Extra field length

    const fullLocal = Buffer.concat([localHeader, filenameBuf, finalData]);
    localHeaders.push(fullLocal);

    // Central directory file header
    const centralDir = Buffer.alloc(46);
    centralDir.writeUInt32LE(0x02014b50, 0); // Central file header signature
    centralDir.writeUInt16LE(20, 4);         // Version made by
    centralDir.writeUInt16LE(20, 6);         // Version needed to extract
    centralDir.writeUInt16LE(0, 8);          // General purpose bit flag
    centralDir.writeUInt16LE(compressionMethod, 10);
    centralDir.writeUInt16LE(0, 12);         // Last mod file time
    centralDir.writeUInt16LE(0, 14);         // Last mod file date
    centralDir.writeUInt32LE(crc, 16);       // CRC32
    centralDir.writeUInt32LE(finalData.length, 20);        // Compressed size
    centralDir.writeUInt32LE(uncompressedData.length, 24); // Uncompressed size
    centralDir.writeUInt16LE(filenameBuf.length, 28);      // File name length
    centralDir.writeUInt16LE(0, 30);                       // Extra field length
    centralDir.writeUInt16LE(0, 32);                       // File comment length
    centralDir.writeUInt16LE(0, 34);                       // Disk number start
    centralDir.writeUInt16LE(0, 36);                       // Internal file attributes
    centralDir.writeUInt32LE(0, 38);                       // External file attributes
    centralDir.writeUInt32LE(offset, 42);                  // Relative offset of local header

    const fullCentral = Buffer.concat([centralDir, filenameBuf]);
    centralDirs.push(fullCentral);

    offset += fullLocal.length;
  }

  const centralDirBuffer = Buffer.concat(centralDirs);
  const centralDirOffset = offset;
  const centralDirSize = centralDirBuffer.length;

  // End of central directory record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);           // End of central dir signature
  eocd.writeUInt16LE(0, 4);                    // Number of this disk
  eocd.writeUInt16LE(0, 6);                    // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8);         // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10);        // Total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12);      // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);    // Offset of start of central directory
  eocd.writeUInt16LE(0, 20);                   // Comment length

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}

function collectFiles(dir, baseDir = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (item.endsWith('.zip')) continue; // Skip existing zip files
    const fullPath = path.join(dir, item);
    const relPath = baseDir ? `${baseDir}/${item}` : item;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(collectFiles(fullPath, relPath));
    } else {
      results.push({
        path: relPath,
        data: fs.readFileSync(fullPath)
      });
    }
  }
  return results;
}

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version || '1.0.0';
const zipName = `youtube-gemini-tts-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

const filesToZip = collectFiles(distDir);
const zipBuffer = createZip(filesToZip);

fs.writeFileSync(zipPath, zipBuffer);
console.log(`Packaged ${filesToZip.length} files into ${zipPath} (${zipBuffer.length} bytes)`);
