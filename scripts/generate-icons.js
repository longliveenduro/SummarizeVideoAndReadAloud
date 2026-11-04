import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create uncompressed/deflated RGBA PNG
function createPNG(width, height, pixelFn) {
  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel;
  const rawData = Buffer.alloc((scanlineLength + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (scanlineLength + 1);
    rawData[rowOffset] = 0; // Filter byte 0 = None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const chunkType = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([chunkType, data]);
    const crcVal = crc32(crcData);

    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);

    return Buffer.concat([length, chunkType, data, crcBuf]);
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Non-interlaced

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 implementation
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

// Generate icon with smooth rounded gradient and a sparkle / soundwave symbol
function renderIcon(size) {
  return createPNG(size, size, (x, y, w, h) => {
    // Normalized coordinates (-1 to 1)
    const nx = (x / (w - 1)) * 2 - 1;
    const ny = (y / (h - 1)) * 2 - 1;

    // Rounded rectangle distance (squircle)
    const cornerRadius = 0.35;
    const dx = Math.max(0, Math.abs(nx) - (1 - cornerRadius));
    const dy = Math.max(0, Math.abs(ny) - (1 - cornerRadius));
    const distFromCorner = Math.hypot(dx, dy);

    if (distFromCorner > cornerRadius) {
      return [0, 0, 0, 0]; // Transparent outside
    }

    // Gradient from YouTube Red (255, 0, 51) to Gemini Purple/Blue (66, 133, 244)
    const t = (nx + ny + 2) / 4; // 0 to 1 diagonally
    let r = Math.round(255 * (1 - t) + 66 * t);
    let g = Math.round(20 * (1 - t) + 133 * t);
    let b = Math.round(50 * (1 - t) + 244 * t);

    // Subtle edge anti-aliasing
    let alpha = 255;
    if (distFromCorner > cornerRadius - 0.05) {
      alpha = Math.round(255 * (cornerRadius - distFromCorner) / 0.05);
    }

    // Center symbol: Gemini Star / Sparkle
    // Center point (0, 0)
    const cx = nx;
    const cy = ny;
    const rDist = Math.hypot(cx, cy);

    // 4-point star equation: |x|^0.5 + |y|^0.5 <= radius
    const starVal = Math.pow(Math.abs(cx), 0.6) + Math.pow(Math.abs(cy), 0.6);
    if (starVal < 0.65) {
      // White sparkle core
      return [255, 255, 255, alpha];
    }

    // Sound wave arcs on sides (right side: speech/TTS indication)
    const waveDist = Math.hypot(cx + 0.1, cy);
    if (cx > 0.25 && waveDist > 0.45 && waveDist < 0.65 && Math.abs(cy) < 0.4) {
      return [255, 255, 255, Math.min(alpha, 220)];
    }
    if (cx > 0.45 && waveDist > 0.72 && waveDist < 0.88 && Math.abs(cy) < 0.55) {
      return [255, 255, 255, Math.min(alpha, 180)];
    }

    return [r, g, b, alpha];
  });
}

const iconsDir = path.resolve(__dirname, '../icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const filePath = path.join(iconsDir, `icon${size}.png`);
  const pngBuf = renderIcon(size);
  fs.writeFileSync(filePath, pngBuf);
  console.log(`Generated ${filePath} (${pngBuf.length} bytes)`);
});

