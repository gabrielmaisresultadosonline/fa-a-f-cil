import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { listarVozes, type Voz } from "@/lib/tts";
import { AppShell } from "@/components/motion/AppShell";
import { AGENTES } from "@/lib/projects";
import { getCreds, MODELOS, MODELO_PADRAO, SERVIDOR_PADRAO, setCreds } from "@/lib/settings";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Administração — MotionMRO" },
    { name: "description", content: "Token da OpenAI, modelo, agentes e armazenamento do MotionMRO." },
    { property: "og:title", content: "Administração — MotionMRO" },
    { property: "og:description", content: "Token da OpenAI, modelo, agentes e armazenamento do MotionMRO." },
  ] }),
  component: Admin,
});

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Admin() {
  const [token, setToken] = useState("");
  const [modelo, setModelo] = useState(MODELO_PADRAO);
  const [salvo, setSalvo] = useState(false);
  const [servidor, setServidor] = useState(SERVIDOR_PADRAO);
  const [status, setStatus] = useState("");
  const [eleven, setEleven] = useState("");
  const [voz, setVoz] = useState("");
  const [vozModelo, setVozModelo] = useState("eleven_multilingual_v2");
  const [vozes, setVozes] = useState<Voz[]>([]);
  const [carregando, setCarregando] = useState(false);
  async function carregarVozes(tk = eleven) {
    if (!tk.trim()) return; setCarregando(true);
    try { setVozes(await listarVozes(tk.trim())); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    setCarregando(false);
  }
  function salvarVoz() {
    const v = vozes.find((x) => x.voice_id === voz);
    setCreds({ elevenToken: eleven.trim(), voz, vozNome: v?.name ?? getCreds().vozNome ?? "", vozModelo }); toast.success("Voz salva");
  }
  useEffect(() => { const c = getCreds(); setToken(c.token ?? ""); setModelo(c.modelo ?? MODELO_PADRAO); setSalvo(!!c.token); setServidor(c.servidor ?? SERVIDOR_PADRAO); setEleven(c.elevenToken ?? ""); setVoz(c.voz ?? ""); setVozModelo(c.vozModelo ?? "eleven_multilingual_v2"); if (c.elevenToken) void carregarVozes(c.elevenToken); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function salvar() { setCreds({ token: token.trim(), modelo, servidor: servidor.trim() }); setSalvo(!!token.trim()); toast.success("Configuração salva"); }
  return (
    <AppShell title="Administração">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold">OpenAI</h3>
          <p className="mt-1 text-sm text-muted-foreground">Cole seu token da OpenAI (começa com <code>sk-</code>). Ele é usado por todos os agentes e pela transcrição do Video Overlay.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_300px_auto]">
            <input type="password" className={field} placeholder="sk-..." value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            <select className={field} value={modelo} onChange={(e) => setModelo(e.target.value)}>{MODELOS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
            <button onClick={salvar} className="rounded-md bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Salvar</button>
          </div>
          <p className={`mt-2 text-xs ${salvo ? "text-success" : "text-muted-foreground"}`}>{salvo ? "Token salvo neste navegador." : "Nenhum token salvo."}</p>
        </section>
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold">Voz — ElevenLabs</h3>
          <p className="mt-1 text-sm text-muted-foreground">Cole o token da ElevenLabs (Profile → API Keys), carregue suas vozes e escolha a que será usada nas narrações.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input type="password" className={field} placeholder="Token da ElevenLabs" value={eleven} onChange={(e) => setEleven(e.target.value)} autoComplete="off" />
            <button onClick={() => carregarVozes()} className="rounded-md border border-border px-4 py-2 text-sm">{carregando ? "Carregando…" : "Carregar vozes"}</button>
          </div>
          {vozes.length > 0 && (
            <div className="mt-4 grid max-h-72 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
              {vozes.map((v) => (
                <button key={v.voice_id} onClick={() => setVoz(v.voice_id)} data-on={voz === v.voice_id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-left text-sm transition-colors hover:border-primary data-[on=true]:border-primary data-[on=true]:shadow-glow">
                  {v.preview_url && <span role="button" tabIndex={0} aria-label="Ouvir" onClick={(e) => { e.stopPropagation(); void new Audio(v.preview_url).play(); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary hover:text-primary"><Play className="h-3.5 w-3.5" /></span>}
                  <span className="min-w-0"><span className="block truncate font-medium">{v.name}</span><span className="block truncate text-xs text-muted-foreground">{Object.values(v.labels ?? {}).join(" · ")}</span></span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <select className={field} value={vozModelo} onChange={(e) => setVozModelo(e.target.value)}>
              <option value="eleven_multilingual_v2">Multilingual v2 — melhor qualidade</option>
              <option value="eleven_turbo_v2_5">Turbo v2.5 — mais rápido e barato</option>
              <option value="eleven_flash_v2_5">Flash v2.5 — o mais barato</option>
              <option value="eleven_v3">Eleven v3 — mais expressivo</option>
            </select>
            <button onClick={salvarVoz} className="rounded-md bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Salvar voz</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{voz ? `Voz selecionada: ${vozes.find((x) => x.voice_id === voz)?.name ?? "salva"}` : "Nenhuma voz salva."}</p>
        </section>
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold">Servidor de renderização (FFmpeg / HyperFrames)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Endereço do servidor que gera o MP4 final — no seu computador (localhost) ou numa VPS. O programa do servidor está na pasta <code>render-server</code> do projeto.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input className={field} value={servidor} onChange={(e) => setServidor(e.target.value)} placeholder="http://localhost:4400" />
            <button onClick={async () => { setStatus("Testando…"); try { const r = await fetch(servidor.replace(/\/+$/, "")); setStatus(r.ok ? "Servidor conectado ✓" : "Servidor respondeu com erro"); } catch { setStatus("Servidor não encontrado"); } }} className="rounded-md border border-border px-4 py-2 text-sm">Testar</button>
            <button onClick={salvar} className="rounded-md bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Salvar</button>
          </div>
          {status && <p className="mt-2 text-xs text-muted-foreground">{status}</p>}
        </section>
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold">Agentes ativos</h3>
          <ul className="mt-3 space-y-2 text-sm">{AGENTES.map((a) => <li key={a.key} className="flex justify-between"><span>{a.nome}</span><span className="text-success">ativo</span></li>)}</ul>
        </section>
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold">Armazenamento</h3>
          <p className="mt-2 text-sm text-muted-foreground">Projetos, vídeos e o token ficam salvos só neste navegador, sem serviços externos.</p>
        </section>
      </div>
    </AppShell>
  );
}
