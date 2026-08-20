// StageCue — edge function: serve o app e cadastra usuários (já confirmados)
import { createClient } from "jsr:@supabase/supabase-js@2";
import { HTML } from "./html.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PAGE = HTML
  .replace("__SUPABASE_URL__", SUPABASE_URL)
  .replace("__SUPABASE_ANON_KEY__", ANON_KEY);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname.endsWith("/signup")) {
    try {
      const { email, password, name } = await req.json();
      if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ error: "E-mail inválido." }, 400);
      }
      if (typeof password !== "string" || password.length < 8) {
        return json({ error: "A senha precisa ter no mínimo 8 caracteres." }, 400);
      }
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: typeof name === "string" ? name.slice(0, 80) : "" },
      });
      if (error) {
        const msg = /already/i.test(error.message)
          ? "Este e-mail já tem conta. Use a aba Entrar."
          : error.message;
        return json({ error: msg }, 400);
      }
      return json({ ok: true });
    } catch (_e) {
      return json({ error: "Requisição inválida." }, 400);
    }
  }

  return new Response(PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
