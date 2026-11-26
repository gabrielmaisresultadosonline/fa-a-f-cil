import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/motion/AppShell";
import { AGENTES } from "@/lib/projects";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Administração — MotionMRO" },
    { name: "description", content: "Configurações de IA, agentes e armazenamento do MotionMRO." },
    { property: "og:title", content: "Administração — MotionMRO" },
    { property: "og:description", content: "Configurações de IA, agentes e armazenamento do MotionMRO." },
  ] }),
  component: () => (
    <AppShell title="Administração">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold">Inteligência artificial</h3>
          <p className="mt-2 text-sm text-muted-foreground">Modelo em uso por todos os agentes:</p>
          <div className="mt-3 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-primary">OpenAI GPT-6.1 Terra</div>
          <p className="mt-2 text-xs text-muted-foreground">Conectado e pronto, sem chave para configurar.</p>
        </section>
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold">Agentes ativos</h3>
          <ul className="mt-3 space-y-2 text-sm">{AGENTES.map((a) => <li key={a.key} className="flex justify-between"><span>{a.nome}</span><span className="text-success">ativo</span></li>)}</ul>
        </section>
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold">Armazenamento</h3>
          <p className="mt-2 text-sm text-muted-foreground">Os projetos ficam salvos neste navegador (IndexedDB), sem depender de serviços externos.</p>
        </section>
      </div>
    </AppShell>
  ),
});
