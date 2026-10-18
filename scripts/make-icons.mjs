#!/usr/bin/env node
// Generates the PWA PNG icons (a Poké Ball) without image dependencies. Run once; outputs are committed.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/public/icons');

const RED = [215, 38, 61];
const WHITE = [255, 255, 255];
const INK = [22, 24, 29];
const BG = [17, 19, 24];

/** Colour at (x, y) in a unit square for a ball of radius r centred at 0.5. */
function shade(x, y, r) {
  const dy = y - 0.5;
  const d = Math.hypot(x - 0.5, dy);
  if (d > r) return null;
  if (d > r * 0.91) return INK; // outline
  if (d < r * 0.2) return WHITE; // button
  if (d < r * 0.32 || Math.abs(dy) < r * 0.08) return INK; // button ring and centre band
  return dy < 0 ? RED : WHITE;
}

const SUPERSAMPLING = 4; // samples per axis, for smooth edges

/** Averaged RGBA of one output pixel. */
function samplePixel(x, y, size, { r, background }) {
  const acc = [0, 0, 0, 0];
  for (let sy = 0; sy < SUPERSAMPLING; sy++) {
    for (let sx = 0; sx < SUPERSAMPLING; sx++) {
      const c = shade((x + (sx + 0.5) / SUPERSAMPLING) / size, (y + (sy + 0.5) / SUPERSAMPLING) / size, r) ?? background;
      if (c) for (let i = 0; i < 3; i++) acc[i] += c[i];
      if (c) acc[3] += 255;
    }
  }
  const div = acc[3] ? acc[3] / 255 : 1;
  return [acc[0] / div, acc[1] / div, acc[2] / div, acc[3] / SUPERSAMPLING ** 2].map(Math.round);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, { maskable }) {
  const style = { r: maskable ? 0.36 : 0.48, background: maskable ? BG : null };
  const stride = size * 4 + 1; // filter byte + RGBA per row
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) raw.set(samplePixel(x, y, size, style), y * stride + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

writeFileSync(path.join(outDir, 'icon-192.png'), png(192, { maskable: false }));
writeFileSync(path.join(outDir, 'icon-512.png'), png(512, { maskable: false }));
writeFileSync(path.join(outDir, 'icon-512-maskable.png'), png(512, { maskable: true }));
writeFileSync(path.join(outDir, 'apple-touch-icon.png'), png(180, { maskable: true }));
console.log(`Icons written to ${outDir}`);
