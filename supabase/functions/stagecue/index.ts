// StageCue — edge function: API de cadastro (+ redireciona GET para o app no GitHub Pages)
// O HTML não é servido daqui: o gateway do Supabase força text/plain em *.supabase.co.
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_URL = "https://pedrocobron-ops.github.io/stagecue/";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

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

  return new Response(null, { status: 302, headers: { Location: APP_URL } });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
