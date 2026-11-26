import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/motion/AppShell";
import { AGENTES } from "@/lib/projects";
import { getCreds, MODELOS, setCreds } from "@/lib/settings";

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
  const [modelo, setModelo] = useState("gpt-4.1");
  const [salvo, setSalvo] = useState(false);
  useEffect(() => { const c = getCreds(); setToken(c.token ?? ""); setModelo(c.modelo ?? "gpt-4.1"); setSalvo(!!c.token); }, []);
  function salvar() { setCreds({ token: token.trim(), modelo }); setSalvo(!!token.trim()); toast.success("Configuração salva"); }
  return (
    <AppShell title="Administração">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold">OpenAI</h3>
          <p className="mt-1 text-sm text-muted-foreground">Cole seu token da OpenAI (começa com <code>sk-</code>). Ele é usado por todos os agentes e pela transcrição do Video Overlay.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input type="password" className={field} placeholder="sk-..." value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            <select className={field} value={modelo} onChange={(e) => setModelo(e.target.value)}>{MODELOS.map((m) => <option key={m}>{m}</option>)}</select>
            <button onClick={salvar} className="rounded-md bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Salvar</button>
          </div>
          <p className={`mt-2 text-xs ${salvo ? "text-success" : "text-muted-foreground"}`}>{salvo ? "Token salvo neste navegador." : "Nenhum token salvo."}</p>
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
