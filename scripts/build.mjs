// Gera dist/index.html a partir do app.html, injetando URL e chave pública do Supabase.
// (A chave "publishable" é pública por design — a segurança vem do Auth + RLS.)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SUPABASE_URL = "https://wriwfpqdovcccdggektm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KMIQvvItlTW_Z8mawuh37w_Dn1bYvPb";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "supabase/functions/stagecue/app.html"), "utf8")
  .replace("__SUPABASE_URL__", SUPABASE_URL)
  .replace("__SUPABASE_ANON_KEY__", SUPABASE_PUBLISHABLE_KEY);

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/index.html"), html);

// Service worker: rede primeiro, cache como reserva — o app abre mesmo sem internet.
// A versão do cache muda junto com o conteúdo do app.
let hash = 0;
for (let i = 0; i < html.length; i++) hash = (hash * 31 + html.charCodeAt(i)) >>> 0;
const sw = `// GERADO por scripts/build.mjs
const CACHE = 'stagecue-${hash.toString(36)}';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const cacheable = u.origin === location.origin || u.hostname === 'cdn.jsdelivr.net';
  if (!cacheable) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    try {
      const r = await fetch(e.request);
      if (r && r.ok) c.put(e.request, r.clone());
      return r;
    } catch (err) {
      const m = await c.match(e.request, { ignoreSearch: u.origin === location.origin });
      if (m) return m;
      throw err;
    }
  }));
});
`;
writeFileSync(join(root, "dist/sw.js"), sw);

// ---- PWA: manifest + ícones PNG (triângulo de play verde sobre fundo escuro) ----
function crc32(buf) {
  let c, table = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function makeIcon(S) {
  const raw = Buffer.alloc(S * (S * 4 + 1));
  const bg = [0x0b, 0x0d, 0x10], fg = [0x22, 0xc5, 0x5e];
  const x0 = 0.34 * S, x1 = 0.76 * S, yTop = 0.26 * S, yBot = 0.74 * S, yMid = 0.5 * S;
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0; // filtro none
    for (let x = 0; x < S; x++) {
      // triângulo: entre x0..x1, afunilando de (yTop..yBot) até yMid
      const f = x <= x0 ? 0 : x >= x1 ? 1 : (x - x0) / (x1 - x0);
      const inTri = x >= x0 && x <= x1 && y >= yTop + f * (yMid - yTop) && y <= yBot - f * (yBot - yMid);
      const c = inTri ? fg : bg;
      const o = y * (S * 4 + 1) + 1 + x * 4;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
writeFileSync(join(root, "dist/icon-192.png"), makeIcon(192));
writeFileSync(join(root, "dist/icon-512.png"), makeIcon(512));
writeFileSync(join(root, "dist/manifest.webmanifest"), JSON.stringify({
  name: "StageCue — Operação de Som para Teatro",
  short_name: "StageCue",
  description: "Console de operação de som para teatro: cues, GO, fades e áudios na nuvem.",
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "landscape",
  background_color: "#0b0d10",
  theme_color: "#0b0d10",
  lang: "pt-BR",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
}, null, 1));

console.log("dist/: index.html (" + (html.length / 1024).toFixed(1) + " KB), sw.js (cache " + hash.toString(36) + "), manifest + ícones PWA");
