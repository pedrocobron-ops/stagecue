# 🎭 StageCue — Operação de Som para Teatro

Sistema profissional de operação de som para teatro, **100% web**: acesse de
qualquer computador com login e senha, monte a lista de cues do espetáculo,
suba seus áudios para a nuvem e opere o show com o botão **GO**.

**Acesso online:** https://wriwfpqdovcccdggektm.supabase.co/functions/v1/stagecue

## Por que o StageCue?

Os sistemas de referência do mercado — QLab 5 (US$ 499–999+, só macOS),
Show Cue System (Windows), MultiPlay — são caros ou presos a um sistema
operacional. O StageCue roda em qualquer navegador moderno, é gratuito e
guarda tudo na nuvem: seu espetáculo te acompanha em qualquer cabine.

## Funcionalidades

**Operação**
- Botão **GO** gigante (tecla `Espaço`), navegação de standby com `↑/↓`
- **Pânico** (`Esc`): fade geral de 1 s e para tudo
- **Pausa geral** (`P`) com retomada exata
- Cronômetro do espetáculo (inicia no primeiro GO) + relógio de sala
- Chips dos cues tocando com tempo decorrido; clique para dar fade-out individual
- Barra de progresso ao vivo em cada cue tocando
- Modo **Operação** trava a edição para evitar acidentes durante o show

**Cues**
- Tipos: 🔊 Áudio, 📉 Fade (por cue ou geral, para nível em dB ou parada), ⏹ Parar, 📝 Nota/deixa
- Por cue de áudio: volume em dB, pan, fade in/out, recorte de início/fim,
  **loop infinito** com pontos de loop, pré-espera após o GO
- **Auto-follow**: dispara o próximo cue após X segundos ou quando o áudio terminar
- Numeração livre (1, 1.5, 2…), cores, anotações do operador
- Forma de onda com playhead ao vivo e região de recorte destacada

**Áudio**
- Engine Web Audio API com pré-carregamento de todos os áudios na memória
  (latência zero no GO, imune a oscilação de rede durante o show)
- Fader master em dB + medidor VU com pico
- Vários cues simultâneos (camas sonoras + efeitos por cima)

**Nuvem**
- Login com e-mail e senha (Supabase Auth)
- Espetáculos e cues salvos automaticamente (autosave)
- Biblioteca de áudio por espetáculo em bucket privado (cada usuário só
  acessa os próprios arquivos, garantido por Row Level Security)

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Front-end | HTML/CSS/JS puro + Web Audio API (arquivo único, `app.html`) |
| Hospedagem + API | Supabase Edge Function `stagecue` (serve o app e o endpoint `/signup`) |
| Autenticação | Supabase Auth (e-mail/senha, contas criadas já confirmadas) |
| Banco | Postgres — tabela `stagecue_shows` (cues em JSONB) com RLS por usuário |
| Arquivos | Supabase Storage — bucket privado `stagecue-audio` com RLS por pasta do usuário |

```
supabase/
  migrations/stagecue_init.sql      # tabela, bucket e políticas RLS
  functions/stagecue/
    index.ts                        # edge function (serve app + /signup)
    app.html                        # o aplicativo (edite este)
    html.ts                         # GERADO a partir do app.html
scripts/
  build-html.mjs                    # gera html.ts a partir do app.html
```

## Desenvolvimento

1. Edite `supabase/functions/stagecue/app.html`
2. Rode `node scripts/build-html.mjs` para regenerar `html.ts`
3. Faça o deploy da função `stagecue` (Supabase CLI ou dashboard) com
   `verify_jwt = false` (a página é pública; os dados são protegidos por Auth + RLS)

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `Espaço` | GO — dispara o cue em standby |
| `↑` / `↓` | Move o standby |
| `P` | Pausa/retoma tudo |
| `Esc` | Pânico — fade de 1 s e para tudo |
