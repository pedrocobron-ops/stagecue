// Gera supabase/functions/stagecue/html.ts a partir do app.html
// (o HTML vira uma string TS segura via JSON.stringify)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "supabase/functions/stagecue/app.html");
const out = join(root, "supabase/functions/stagecue/html.ts");

const html = readFileSync(src, "utf8");
// quebra em pedaços para manter linhas curtas no arquivo gerado
const CHUNK = 1000;
const parts = [];
for (let i = 0; i < html.length; i += CHUNK) {
  parts.push(JSON.stringify(html.slice(i, i + CHUNK)));
}
writeFileSync(
  out,
  "// GERADO por scripts/build-html.mjs — não edite manualmente. Edite app.html.\n" +
    "export const HTML =\n  " + parts.join(" +\n  ") + ";\n",
);
console.log("html.ts gerado:", (html.length / 1024).toFixed(1), "KB");
