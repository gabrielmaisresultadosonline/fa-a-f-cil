import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, Sparkles, Layers, FolderOpen, Settings2, Clapperboard, ListVideo, Wallet } from "lucide-react";
import { acompanharFila, listJobs, onQueue } from "@/lib/queue";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/novo", label: "Motion IA", icon: Sparkles },
  { to: "/overlay", label: "Video Overlay IA", icon: Layers },
  { to: "/projetos", label: "Meus projetos", icon: FolderOpen },
  { to: "/fila", label: "Fila de renderização", icon: ListVideo },
  { to: "/custos", label: "Custos", icon: Wallet },
  { to: "/admin", label: "Administração", icon: Settings2 },
] as const;

function useFila() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const up = () => listJobs().then((j) => setN(j.filter((x) => x.status === "enviando" || x.status === "na fila" || x.status === "renderizando").length));
    void up(); const stop = acompanharFila(); const off = onQueue(up); return () => { stop(); off(); };
  }, []);
  return n;
}

export function AppShell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  const fila = useFila();
  return (
    <div className="relative flex min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-orb absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-orb absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-3xl" style={{ animationDelay: "-6s" }} />
      </div>
      <aside className="glass sticky top-0 z-10 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border md:flex">
        <Link to="/" className="flex items-center gap-3 px-5 py-6">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
            <Clapperboard className="h-4 w-4" />
          </span>
          <span className="leading-tight"><span className="block text-lg font-bold tracking-tight">Motion<span className="text-gradient">MRO</span></span>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">AI video studio</span></span>
        </Link>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }}
              className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-primary">
              <span className="absolute left-0 top-1/2 h-0 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all group-data-[status=active]:h-5" />
              <n.icon className="h-4 w-4 transition-transform group-hover:scale-110" />{n.label}
              {n.to === "/fila" && fila > 0 && <span className="ml-auto rounded-full bg-primary px-2 text-[10px] font-bold text-primary-foreground">{fila}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto m-3 rounded-lg border border-border bg-card/60 p-3">
          <div className="flex items-end gap-0.5">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="animate-eq h-4 w-1 rounded-full bg-primary/70" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{fila ? `${fila} na fila de renderização` : "estúdio pronto"}</p>
        </div>
      </aside>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <nav className="flex gap-1 md:hidden">
              {NAV.map((n) => (<Link key={n.to} to={n.to} className="rounded-md p-2 text-muted-foreground data-[status=active]:text-primary" aria-label={n.label}><n.icon className="h-4 w-4" /></Link>))}
            </nav>
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
        </header>
        <main className="animate-fade-up flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
