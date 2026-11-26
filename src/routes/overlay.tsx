import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/motion/AppShell";

export const Route = createFileRoute("/overlay")({
  head: () => ({ meta: [
    { title: "Video Overlay IA — MotionMRO" },
    { name: "description", content: "Overlays animados sincronizados com a fala do seu vídeo." },
    { property: "og:title", content: "Video Overlay IA — MotionMRO" },
    { property: "og:description", content: "Overlays animados sincronizados com a fala do seu vídeo." },
  ] }),
  component: () => (
    <AppShell title="Video Overlay IA">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-stage p-10 text-center grid-lines">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Fase 4 do projeto</p>
        <h2 className="mt-3 text-3xl font-bold">Envio, transcrição e overlays automáticos</h2>
        <p className="mt-3 text-muted-foreground">Este módulo vem na próxima etapa. Por enquanto, crie motion graphics completos no Motion IA.</p>
        <Link to="/novo" className="mt-6 inline-flex rounded-md bg-gradient-primary px-5 py-3 font-semibold text-primary-foreground">Abrir Motion IA</Link>
      </div>
    </AppShell>
  ),
});
