// Gera dist/index.html a partir do app.html, injetando URL e chave pública do Supabase.
// (A chave "publishable" é pública por design — a segurança vem do Auth + RLS.)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
console.log("dist/index.html gerado:", (html.length / 1024).toFixed(1), "KB + sw.js (cache " + hash.toString(36) + ")");
