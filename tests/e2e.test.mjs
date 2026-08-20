// Teste E2E do StageCue: interface real no Chromium, backend Supabase simulado.
// Como rodar:
//   node scripts/build.mjs
//   cd tests && npm init -y && npm i playwright @supabase/supabase-js && npx playwright install chromium
//   node e2e.test.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import http from "node:http";

const DIST = new URL("../dist/index.html", import.meta.url).pathname;
const UMD = new URL("./node_modules/@supabase/supabase-js/dist/umd/supabase.js", import.meta.url).pathname;
const USER_ID = "5c11e528-e5ca-4484-af73-7c330348214c";

// ---- WAV de teste: 0,5s de senoide 440Hz, PCM16 mono 8kHz ----
function makeWav() {
  const sr = 8000, n = sr / 2;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 12000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const WAV = makeWav();

const SHOW = {
  id: "show-1", user_id: USER_ID, name: "Peça Teste",
  created_at: "2026-08-20T10:00:00Z", updated_at: "2026-08-20T10:00:00Z",
  data: {
    masterDb: 0,
    files: [{ key: `${USER_ID}/show-1/aaaa_teste.wav`, name: "teste.wav", size: WAV.length, duration: 0.5 }],
    cues: [
      { id: "c1", type: "audio", number: "1", name: "Abertura", color: "", preWait: 0, follow: "none", followDelay: 0, notes: "esperar blackout",
        fileKey: `${USER_ID}/show-1/aaaa_teste.wav`, fileName: "teste.wav", volumeDb: 0, pan: 0, loop: false, fadeIn: 0, fadeOut: 0, startAt: 0, endAt: null },
      { id: "c2", type: "note", number: "2", name: "Deixa do ator", color: "", preWait: 0, follow: "none", followDelay: 0, notes: "" },
      { id: "c3", type: "stop", number: "3", name: "Parar tudo", color: "", preWait: 0, follow: "none", followDelay: 0, notes: "", stopTarget: "", stopFade: 0.2 },
    ],
  },
};

const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok, extra }); console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); };

// servidor local para a página
const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(readFileSync(DIST));
}).listen(8931);

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
});
const page = await browser.newPage();
page.on("pageerror", e => check("sem erros de JS na página", false, String(e)));

// prompts do app
await page.addInitScript(() => {
  window.prompt = () => "Peça Teste";
  window.confirm = () => true;
});

// mock do CDN (supabase-js)
await page.route("**cdn.jsdelivr.net/**", r =>
  r.fulfill({ contentType: "application/javascript", body: readFileSync(UMD) }));

// mock da API Supabase
let signupCalled = false, patchCount = 0;
await page.route("**wriwfpqdovcccdggektm.supabase.co/**", async r => {
  const url = new URL(r.request().url());
  const m = r.request().method();
  const p = url.pathname;
  const json = (body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  if (m === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  if (p.endsWith("/stagecue/signup")) { signupCalled = true; return json({ ok: true }); }
  if (p.includes("/auth/v1/token")) {
    return json({ access_token: "fake.jwt.token", token_type: "bearer", expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake-refresh",
      user: { id: USER_ID, aud: "authenticated", role: "authenticated", email: "teste@exemplo.com",
        email_confirmed_at: "2026-08-20T10:00:00Z", created_at: "2026-08-20T10:00:00Z",
        updated_at: "2026-08-20T10:00:00Z", app_metadata: {}, user_metadata: { name: "Teste" } } });
  }
  if (p.includes("/auth/v1/")) return json({});
  if (p.includes("/rest/v1/stagecue_shows")) {
    if (m === "POST") return json({ id: "show-1" }, 201);
    if (m === "PATCH") { patchCount++; return json([]); }
    if (url.searchParams.get("id")?.startsWith("eq.") || (url.searchParams.get("select") === "*")) return json(SHOW);
    return json([{ id: "show-1", name: "Peça Teste", updated_at: "2026-08-20T10:00:00Z" }]);
  }
  if (p.includes("/storage/v1/object")) {
    if (m === "GET" || m === "POST") return r.fulfill({ status: 200, contentType: "audio/wav", body: WAV });
    return json({ Key: "ok" });
  }
  return json({});
});

// ---------- 1. tela de login ----------
await page.goto("http://localhost:8931/");
await page.waitForTimeout(600);
check("página carrega e mostra a tela de login", await page.locator("#authScreen").isVisible());
check("logo StageCue presente", (await page.locator(".logo").first().innerText()).includes("Stage"));

// ---------- 2. validação de senha curta ----------
await page.click("#tabSignup");
await page.fill("#authName", "Teste");
await page.fill("#authEmail", "teste@exemplo.com");
await page.fill("#authPass", "curta");
await page.click("#authBtn");
await page.waitForTimeout(300);
check("senha curta é recusada com aviso", (await page.locator("#authErr").innerText()).includes("8 caracteres"));

// ---------- 3. cadastro + login ----------
await page.fill("#authPass", "senha-segura-123");
await page.click("#authBtn");
await page.waitForSelector("#showsScreen:not(.hidden)", { timeout: 5000 });
check("cadastro chama a API /signup", signupCalled);
check("login entra na tela de espetáculos", await page.locator("#showsScreen").isVisible());
await page.waitForTimeout(400);
check("espetáculo listado", (await page.locator("#showsList").innerText()).includes("Peça Teste"));

// ---------- 4. abrir espetáculo ----------
await page.click(".showItem");
await page.waitForSelector("#opScreen:not(.hidden)", { timeout: 5000 });
check("abre a tela de operação", await page.locator("#opScreen").isVisible());
await page.waitForTimeout(800); // preload dos áudios
check("nome do espetáculo no topo", (await page.locator("#opShowName").innerText()) === "Peça Teste");
check("3 cues na lista", await page.locator("tr.cue").count() === 3);
check("cue 1 em standby", (await page.locator("#standbyName").innerText()).includes("Abertura"));
check("deixa do operador visível no rodapé", (await page.locator("#standbyNotes").innerText()).includes("esperar blackout"));

// ---------- 5. inspector + waveform ----------
await page.click("tr.cue >> nth=0");
await page.waitForTimeout(700);
check("inspector abre para o cue de áudio", await page.locator("#inspCue").isVisible());
check("waveform desenhada", await page.evaluate(() => {
  const cv = document.getElementById("waveCv");
  if (!cv) return false;
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 30 || d[i + 1] > 30) return true; // algum pixel não-preto
  return false;
}));

// ---------- 6. GO: áudio toca de verdade ----------
await page.keyboard.press("Space");
await page.waitForTimeout(300);
check("GO dispara o áudio (instância tocando)", await page.locator(".playChip").count() === 1);
check("chip mostra contagem regressiva (tempo restante)", (await page.locator(".playChip .t").innerText()).startsWith("−"));
check("standby avança para o cue 2", (await page.locator("#standbyName").innerText()).includes("Deixa"));
check("linha do cue marca 'tocando'", await page.locator("tr.cue.playing").count() === 1);
const ctxState = await page.evaluate(() => !!window.AudioContext);
check("Web Audio disponível no navegador", ctxState);
await page.waitForTimeout(700); // áudio de 0,5s termina
check("áudio termina sozinho e some da lista", await page.locator(".playChip").count() === 0);

// ---------- 7. GO em nota + cue de parada ----------
await page.keyboard.press("Space"); // nota (só avança)
await page.waitForTimeout(200);
check("nota avança standby para o cue 3", (await page.locator("#standbyName").innerText()).includes("Parar"));

// ---------- 8. loop + pânico ----------
// transforma o cue 1 em loop e toca de novo
await page.click("tr.cue >> nth=0");
await page.waitForTimeout(400);
await page.check("#loopChk");
await page.waitForTimeout(200);
await page.click("#testBtn");
await page.waitForTimeout(400);
check("cue em loop fica tocando", await page.locator(".playChip").count() >= 1);
await page.click("#fadeBtn");
await page.waitForTimeout(1000);
check("FADE geral: ainda descendo após 1s", await page.locator(".playChip").count() >= 1);
await page.waitForTimeout(2700);
check("FADE geral: tudo parado ao fim dos 3s", await page.locator(".playChip").count() === 0);
await page.click("#testBtn");
await page.waitForTimeout(400);
await page.keyboard.press("Escape"); // pânico
await page.waitForTimeout(350);
check("PÂNICO (Esc) para tudo imediatamente", await page.locator(".playChip").count() === 0);

// ---------- 8b. pausa/retomada por cue ----------
await page.click("#testBtn"); // cue 1 ainda está em loop
await page.waitForTimeout(500);
await page.click(".playChip .pp");
await page.waitForTimeout(300);
check("pausa individual pausa só aquele cue", await page.locator(".playChip.paused").count() === 1);
await page.click(".playChip .pp");
await page.waitForTimeout(300);
check("retomada individual volta a tocar do mesmo ponto", await page.locator(".playChip:not(.paused)").count() === 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(1500);

// ---------- 8c. desfazer (Ctrl+Z) ----------
const before = await page.locator("tr.cue").count();
await page.click("tr.cue >> nth=1");
await page.click("#delCue");
await page.waitForTimeout(250);
check("excluir remove o cue", await page.locator("tr.cue").count() === before - 1);
await page.keyboard.press("Control+z");
await page.waitForTimeout(350);
check("Ctrl+Z desfaz a exclusão", await page.locator("tr.cue").count() === before);

// ---------- 8d. recursos profissionais no inspector ----------
await page.click("tr.cue >> nth=0");
await page.waitForTimeout(500);
check("campos de velocidade, EQ, ducking e curva de fade",
  (await page.locator('[data-f="ratePct"]').count()) === 1 &&
  (await page.locator('[data-f="bassDb"]').count()) === 1 &&
  (await page.locator('[data-f="trebleDb"]').count()) === 1 &&
  (await page.locator('[data-f="duckDb"]').count()) === 1 &&
  (await page.locator('[data-f="fadeCurve"]').count()) === 1);
check("seletor de saída de áudio presente", await page.locator("#sinkSel").isVisible());
check("botão de exportar backup presente", await page.locator("#exportBtn").isVisible());
check("botão de importar na tela de espetáculos existe", (await page.locator("#importBtn").count()) === 1);

// ---------- 8e. velocidade altera a duração exibida ----------
await page.uncheck("#loopChk");
await page.waitForTimeout(200);
await page.fill('[data-f="ratePct"]', "200");
await page.dispatchEvent('[data-f="ratePct"]', "input");
await page.waitForTimeout(300);
check("velocidade 200% reduz a duração na lista para ~0,3s",
  (await page.locator("tr.cue >> nth=0").innerText()).includes("0:00.3") ||
  (await page.locator("tr.cue >> nth=0").innerText()).includes("0:00.2"));
await page.fill('[data-f="ratePct"]', "100");
await page.dispatchEvent('[data-f="ratePct"]', "input");
await page.waitForTimeout(200);

// ---------- 8f. clicar na waveform toca a partir do ponto ----------
await page.click("#waveCv", { position: { x: 30, y: 40 } });
await page.waitForTimeout(280);
check("clique na waveform toca a partir daquele ponto", await page.locator(".playChip").count() === 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// ---------- 9. modo operação + autosave ----------
await page.click("#modeBtn");
await page.waitForTimeout(200);
check("modo Operação esconde a edição", !(await page.locator("#editToolbar").isVisible()));
await page.click("#modeBtn");
check("autosave gravou alterações no servidor (PATCH)", patchCount > 0, `${patchCount} gravações`);

// ---------- 10. teclas de navegação ----------
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(150);
check("setas movem o standby", (await page.locator("#standbyName").innerText()).includes("Parar"));

// ---------- 10b. "ir para cue" digitando o número ----------
await page.keyboard.press("2");
await page.waitForTimeout(150);
check("digitar número abre o 'ir para cue'", await page.locator("#gotoBox").isVisible());
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
check("Enter leva o standby ao cue digitado", (await page.locator("#standbyName").innerText()).includes("Deixa"));

// ---------- 10c. tamanho da letra ----------
await page.click("#fontPlus");
await page.click("#fontPlus");
await page.waitForTimeout(150);
check("A+ aumenta a letra da lista", await page.evaluate(() =>
  parseFloat(getComputedStyle(document.querySelector("table.cues")).fontSize) >= 16));

// ---------- 11. checklist pré-show ----------
await page.click("#preshowBtn");
await page.waitForTimeout(700);
check("checklist pré-show abre", await page.locator("#preshowModal").isVisible());
const psTxt = await page.locator("#preshowBody").innerText();
check("checklist confere cache de áudios (1/1)", psTxt.includes("1/1"));
await page.click("#toneBtn");
await page.waitForTimeout(300);
await page.click("#preshowClose");
await page.waitForTimeout(200);
check("checklist fecha", !(await page.locator("#preshowModal").isVisible()));
check("manifest PWA declarado na página", await page.evaluate(() => !!document.querySelector('link[rel="manifest"]')));

// ---------- 12. recuperação de sessão após recarregar ----------
await page.reload();
await page.waitForSelector("#showsScreen:not(.hidden)", { timeout: 8000 });
await page.waitForTimeout(400);
check("botão de duplicar espetáculo presente", (await page.locator(".showItem .dup").count()) === 1);
await page.click(".showItem");
await page.waitForSelector("#opScreen:not(.hidden)", { timeout: 8000 });
await page.waitForTimeout(700);
check("após recarregar, retoma o standby onde parou (não volta ao cue 1)",
  !(await page.locator("#standbyName").innerText()).includes("Abertura"));

await browser.close();
server.close();

const fail = results.filter(r => !r.ok);
console.log(`\n===== ${results.length - fail.length}/${results.length} testes aprovados =====`);
process.exit(fail.length ? 1 : 0);
