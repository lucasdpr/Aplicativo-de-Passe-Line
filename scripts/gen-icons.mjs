// Generates simple placeholder square PNG icons (solid background + "PL" mark)
// so the PWA manifest has valid icons without needing external image tools.
// Replace with real branded icons later.
import { writeFileSync, mkdirSync } from "node:fs";
import zlib from "node:zlib";

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size, bg, fg) {
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter type none
    const margin = Math.floor(size * 0.18);
    const inMark = y > margin && y < size - margin;
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3;
      const inMarkX = x > margin && x < size - margin;
      // simple diagonal stripe mark to avoid needing fonts
      const stripe = inMark && inMarkX && (x - y > -size * 0.1 && x - y < size * 0.1);
      const [r, g, b] = stripe ? fg : bg;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
const bg = [11, 18, 32]; // #0b1220
const fg = [56, 189, 248]; // sky-400

writeFileSync("public/icons/icon-192.png", makePng(192, bg, fg));
writeFileSync("public/icons/icon-512.png", makePng(512, bg, fg));
writeFileSync("public/icons/icon-512-maskable.png", makePng(512, bg, fg));

console.log("Icons generated in public/icons/");
