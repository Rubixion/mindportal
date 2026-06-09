/**
 * Generates simple PNG icons for FocusForge using Node.js built-in zlib.
 * Run: node scripts/generate-icons.js
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function createPNG(size, r, g, b) {
  // Build raw image data: size × size pixels, each row = filter byte + RGB
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      // Draw a rounded-ish flame shape in contrasting color
      const px = x / size;
      const py = y / size;
      const inIcon = isInIcon(px, py, size);
      if (inIcon) {
        row[1 + x * 3] = r;
        row[2 + x * 3] = g;
        row[3 + x * 3] = b;
      } else {
        row[1 + x * 3] = 24;
        row[2 + x * 3] = 24;
        row[3 + x * 3] = 24;
      }
    }
    rows.push(row);
  }

  const rawData = Buffer.concat(rows);
  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (const byte of buf) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, "ascii");
    const combined = Buffer.concat([typeB, data]);
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeB, data, crcB]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function isInIcon(px, py, size) {
  if (size <= 16) {
    // Simple flame shape for small icons: filled square with rounded corners
    const cx = Math.abs(px - 0.5);
    const cy = Math.abs(py - 0.5);
    return cx < 0.38 && cy < 0.38;
  }
  // Larger: draw "FF" letter-like shape or flame
  // For simplicity: filled rounded rect
  const r = 0.15; // corner radius
  const mx = Math.abs(px - 0.5) - (0.5 - r);
  const my = Math.abs(py - 0.5) - (0.5 - r);
  if (mx > 0 && my > 0) return mx * mx + my * my < r * r;
  return Math.abs(px - 0.5) < 0.4 && Math.abs(py - 0.5) < 0.4;
}

const sizes = [16, 32, 48, 128];
const outDir = path.join(__dirname, "../src/assets/icons");
fs.mkdirSync(outDir, { recursive: true });

for (const size of sizes) {
  const png = createPNG(size, 108, 99, 255); // #6c63ff purple
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓ Generated ${outPath} (${png.length} bytes)`);
}

console.log("\nIcons generated successfully.");
