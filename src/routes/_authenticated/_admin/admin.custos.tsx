import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Wallet, Timer, Film, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/motion/AppShell";
import { fmtBRL, fmtUSD, limparCustos, listCustos, type Custo } from "@/lib/costs";
import { listProjects } from "@/lib/projects";
import { listOverlays } from "@/lib/overlays";
import { getPrecos, MODELOS, setCreds, type Precos } from "@/lib/settings";
import { adminAction } from "@/lib/saas.functions";
import { useAccount } from "@/components/motion/AccountProvider";

export const Route = createFileRoute("/_authenticated/_admin/admin/custos")({
  head: () => ({ meta: [
    { title: "Custos por vídeo — MotionMRO" },
    { name: "description", content: "Histórico do custo de cada geração: IA, transcrição e voz, por projeto e por segundo de vídeo." },
    { property: "og:title", content: "Custos por vídeo — MotionMRO" },
    { property: "og:description", content: "Histórico do custo de cada geração: IA, transcrição e voz, por projeto e por segundo de vídeo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Custos,
});

const TIPO = { ia: "IA (OpenAI)", transcricao: "Transcrição", voz: "Voz (ElevenLabs)", render: "Render" } as const;
const field = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

function Custos() {
  const {refresh}=useAccount();
  const [allTotal,setAllTotal]=useState(0);
  const [customerCosts,setCustomerCosts]=useState<Awaited<ReturnType<typeof adminAction>>["customerCosts"]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [dur, setDur] = useState<Record<string, number>>({});
  const [precos, setPrecos] = useState<Precos | null>(null);
  useEffect(() => {
    void adminAction({data:{action:"read",page:0}}).then((r)=>{setCustomerCosts(r.customerCosts);const totals=r.totals;if(totals&&typeof totals==="object"&&!Array.isArray(totals))setAllTotal(Number(totals["total_usd"]??0));});
    listCustos().then(setCustos); setPrecos(getPrecos());
    Promise.all([listProjects(), listOverlays()]).then(([m, o]) => {
      const d: Record<string, number> = {};
      m.forEach((p) => (d[p.id] = p.cenas.reduce((s, c) => s + c.duracao, 0)));
      o.forEach((p) => (d[p.id] = p.duracao)); setDur(d);
    });
  }, []);

  const porProjeto = useMemo(() => {
    const map = new Map<string, { nome: string; modulo: string; total: number; tipos: Record<string, number>; chamadas: number; ultima: number }>();
    for (const c of custos) {
      const x = map.get(c.projetoId) ?? { nome: c.projetoNome, modulo: c.modulo, total: 0, tipos: {}, chamadas: 0, ultima: 0 };
      x.total += c.usd; x.tipos[c.tipo] = (x.tipos[c.tipo] ?? 0) + c.usd; x.chamadas++; x.ultima = Math.max(x.ultima, c.t);
      map.set(c.projetoId, x);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v, seg: dur[id] ?? 0 })).sort((a, b) => b.ultima - a.ultima);
  }, [custos, dur]);

  const total = allTotal;
  const media = (mod: string) => {
    const ps = porProjeto.filter((p) => p.modulo === mod && p.seg > 0);
    const seg = ps.reduce((s, p) => s + p.seg, 0);
    return seg ? ps.reduce((s, p) => s + p.total, 0) / seg : 0;
  };
  const mMotion = media("motion"), mOverlay = media("overlay");

  async function salvarPrecos() { if (!precos) return;try{await adminAction({data:{action:"settings",prices:{...precos}}});await refresh();toast.success("Tabela de preços salva para todos os clientes");listCustos().then(setCustos);}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar.");} }

  return (
    <AppShell title="Custos por vídeo" >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { i: Wallet, k: "Gasto total registrado", v: fmtUSD(total), s: fmtBRL(total) },
          { i: Film, k: "Projetos com custo", v: String(porProjeto.length), s: `${custos.length} chamadas` },
          { i: Timer, k: "Motion IA — por segundo", v: fmtUSD(mMotion), s: fmtBRL(mMotion) },
          { i: Timer, k: "Overlay — por segundo", v: fmtUSD(mOverlay), s: fmtBRL(mOverlay) },
        ].map((c, i) => (
          <div key={c.k} className="animate-fade-up rounded-xl border border-border bg-card/70 p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <c.i className="h-5 w-5 text-primary" />
            <div className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{c.k}</div>
            <div className="mt-1 text-2xl font-bold">{c.v}</div><div className="text-xs text-muted-foreground">{c.s}</div>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card/70 p-5">
        <h3 className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary" />Estimativa por vídeo (base para créditos)</h3>
        <p className="mt-1 text-xs text-muted-foreground">Calculada pela média real dos seus projetos (custo ÷ segundos de vídeo). Quanto mais projetos, mais precisa.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left font-mono text-xs uppercase text-muted-foreground"><tr><th className="py-2">Duração</th><th>Motion IA</th><th>Video Overlay</th></tr></thead>
          <tbody>{[15, 30, 60, 90].map((s) => (
            <tr key={s} className="border-t border-border"><td className="py-2 font-mono">{s}s</td><td>{fmtUSD(mMotion * s)} <span className="text-muted-foreground">({fmtBRL(mMotion * s)})</span></td><td>{fmtUSD(mOverlay * s)} <span className="text-muted-foreground">({fmtBRL(mOverlay * s)})</span></td></tr>
          ))}</tbody>
        </table></div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card/70 p-5">
        <h3 className="font-semibold">Custo por projeto</h3>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left font-mono text-xs uppercase text-muted-foreground"><tr><th className="py-2">Projeto</th><th>Módulo</th><th>Vídeo</th><th>IA</th><th>Transcrição</th><th>Voz</th><th>Total</th><th>Por segundo</th></tr></thead>
          <tbody>
            {porProjeto.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Ainda sem gerações registradas. Os custos aparecem a partir dos próximos projetos.</td></tr>}
            {porProjeto.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="max-w-56 truncate py-2 font-medium">{p.nome}</td><td className="text-muted-foreground">{p.modulo === "motion" ? "Motion" : "Overlay"}</td>
                <td className="font-mono">{p.seg ? `${p.seg.toFixed(0)}s` : "—"}</td>
                <td>{fmtUSD(p.tipos['ia'] ?? 0)}</td><td>{fmtUSD(p.tipos['transcricao'] ?? 0)}</td><td>{fmtUSD(p.tipos['voz'] ?? 0)}</td>
                <td className="font-semibold text-primary">{fmtUSD(p.total)}<div className="text-xs font-normal text-muted-foreground">{fmtBRL(p.total)}</div></td>
                <td className="font-mono">{p.seg ? fmtUSD(p.total / p.seg) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card/70 p-5">
          <h3 className="font-semibold">Histórico de gerações (últimas 500 chamadas)</h3>
          <div className="mt-3 max-h-[28rem] overflow-auto text-xs">
            {custos.slice(0, 300).map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-border py-2">
                <span className="w-28 shrink-0 font-mono text-muted-foreground">{new Date(c.t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="min-w-0 flex-1 truncate"><b>{c.projetoNome}</b> · {c.etapa}<span className="block text-muted-foreground">{TIPO[c.tipo]} · {c.modelo} · {c.tipo === "ia" ? `${c.entrada}+${c.saida} tokens` : c.tipo === "voz" ? `${c.unidades} caracteres` : `${c.unidades.toFixed(2)} min`}</span></span>
                <span className="font-mono">{fmtUSD(c.usd)}</span>
              </div>
            ))}
          </div>
        </section>
        {precos && (
          <section className="rounded-xl border border-border bg-card/70 p-5">
            <h3 className="font-semibold">Tabela de preços (US$)</h3>
            <p className="mt-1 text-xs text-muted-foreground">Ajuste conforme a tabela atual da OpenAI e do seu plano ElevenLabs. Valores usados nos próximos cálculos.</p>
            <div className="mt-3 grid grid-cols-[1fr_80px_80px_80px] gap-2 text-xs">
              <span className="font-mono uppercase text-muted-foreground">Modelo</span><span className="font-mono uppercase text-muted-foreground">Entrada/1M</span><span className="font-mono uppercase text-muted-foreground">Saída/1M</span><span className="font-mono uppercase text-muted-foreground">Cache/1M</span>
              {MODELOS.map((m) => (
                <div key={m.id} className="contents">
                  <span className="self-center">{m.id}</span>
                  {(["entrada", "saida", "cache"] as const).map((k) => (
                    <input key={k} type="number" step="0.01" className={field} value={precos.modelos[m.id]?.[k] ?? 0}
                      onChange={(e) => setPrecos({ ...precos, modelos: { ...precos.modelos, [m.id]: { ...(precos.modelos[m.id] ?? { entrada: 0, saida: 0 }), [k]: Number(e.target.value) } } })} />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <label>Transcrição/min<input type="number" step="0.001" className={field} value={precos.transcricaoMin} onChange={(e) => setPrecos({ ...precos, transcricaoMin: Number(e.target.value) })} /></label>
              <label>Voz/1.000 caract.<input type="number" step="0.01" className={field} value={precos.vozMilChars} onChange={(e) => setPrecos({ ...precos, vozMilChars: Number(e.target.value) })} /></label>
              <label>Dólar (R$)<input type="number" step="0.01" className={field} value={precos.dolar} onChange={(e) => setPrecos({ ...precos, dolar: Number(e.target.value) })} /></label>
            </div>
            <button onClick={salvarPrecos} className="mt-4 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Salvar preços</button>
          </section>
        )}
      </div>
    </AppShell>
  );
}
