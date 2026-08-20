// StageCue — edge function: API de cadastro (+ redireciona GET para o app no GitHub Pages)
// O HTML não é servido daqui: o gateway do Supabase força text/plain em *.supabase.co.
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_URL = "https://pedrocobron-ops.github.io/stagecue/";
const ALLOW_ORIGIN = "https://pedrocobron-ops.github.io";
const MAX_PER_HOUR = 5; // cadastros por IP por hora

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Vary": "Origin",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname.endsWith("/signup")) {
    try {
      const body = await req.json();
      const { email, password, name } = body;

      // honeypot: campo oculto que só um bot preencheria — finge sucesso
      if (typeof body.company === "string" && body.company !== "") {
        return json({ ok: true });
      }
      if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ error: "E-mail inválido." }, 400);
      }
      if (typeof password !== "string" || password.length < 8) {
        return json({ error: "A senha precisa ter no mínimo 8 caracteres." }, 400);
      }

      // rate-limit por IP (janela de 1h)
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconhecido";
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { count } = await admin
        .from("stagecue_signup_throttle")
        .select("*", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("ts", since);
      if ((count ?? 0) >= MAX_PER_HOUR) {
        return json({ error: "Muitas tentativas de cadastro. Tente novamente mais tarde." }, 429);
      }
      await admin.from("stagecue_signup_throttle").insert({ ip });

      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: typeof name === "string" ? name.slice(0, 80) : "" },
      });
      if (error) {
        // não vaza detalhe interno do GoTrue; loga só no servidor
        console.error("createUser:", error.message);
        const msg = /already|exist|registered/i.test(error.message)
          ? "Este e-mail já tem conta. Use a aba Entrar."
          : "Não foi possível criar a conta. Verifique os dados e tente novamente.";
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
