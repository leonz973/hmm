// 生成 PWA 图标：绿色圆角底 + 白色房子。纯 Node，无第三方依赖。
// 用法：node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/web/public');

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** 圆角矩形覆盖率（0/1），坐标按边长百分比 */
const inRoundRect = (x, y, r) => {
  const dx = Math.max(0, Math.abs(x - 0.5) - (0.5 - r));
  const dy = Math.max(0, Math.abs(y - 0.5) - (0.5 - r));
  return dx * dx + dy * dy <= r * r + 1e-9;
};

const inTriangle = (x, y, ax, ay, bx, by, cx, cy) => {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};

const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

function render(size, { maskable = false, pad = 0 } = {}) {
  const S = 4; // 超采样
  const out = Buffer.alloc(size * size * 4);
  const inner = maskable ? 0.72 : 1; // maskable 图标四周留安全边
  const half = inner / 2;
  const radius = maskable ? 0.5 : 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = (x + (sx + 0.5) / S) / size;
          const py = (y + (sy + 0.5) / S) / size;
          // 映射到图标坐标系
          const u = (px - 0.5) / inner + 0.5;
          const v = (py - 0.5) / inner + 0.5;
          let cr = 0, cg = 0, cb = 0, ca = 0;
          if (inRoundRect(u, v, radius) && u >= 0 && u <= 1 && v >= 0 && v <= 1) {
            cr = 0x05; cg = 0x96; cb = 0x69; ca = 255;
            // 白色房子：屋顶三角 + 墙体 + 门（门是绿色）
            const roof = inTriangle(u, v, 0.5, 0.24, 0.20, 0.52, 0.80, 0.52);
            const wall = inRect(u, v, 0.28, 0.50, 0.72, 0.78);
            if (roof || wall) { cr = 255; cg = 255; cb = 255; }
            if (inRect(u, v, 0.44, 0.60, 0.56, 0.78)) { cr = 0x05; cg = 0x96; cb = 0x69; }
          }
          r += cr * (ca / 255); g += cg * (ca / 255); b += cb * (ca / 255); a += ca;
        }
      }
      const n = S * S;
      const alpha = a / n;
      const i = (y * size + x) * 4;
      if (alpha > 0) {
        out[i] = Math.round(r / (a / 255 || 1));
        out[i + 1] = Math.round(g / (a / 255 || 1));
        out[i + 2] = Math.round(b / (a / 255 || 1));
      }
      out[i + 3] = Math.round(alpha);
    }
  }
  return png(size, size, out);
}

mkdirSync(OUT, { recursive: true });
const targets = [
  ['pwa-192.png', 192, {}],
  ['pwa-512.png', 512, {}],
  ['pwa-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }],
];
for (const [name, size, opts] of targets) {
  writeFileSync(resolve(OUT, name), render(size, opts));
  console.log('wrote', name, size);
}
