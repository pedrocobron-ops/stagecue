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
console.log("dist/index.html gerado:", (html.length / 1024).toFixed(1), "KB");
