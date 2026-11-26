import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Sparkles, Layers, FolderOpen, Settings2, Clapperboard } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/novo", label: "Motion IA", icon: Sparkles },
  { to: "/overlay", label: "Video Overlay IA", icon: Layers },
  { to: "/projetos", label: "Meus projetos", icon: FolderOpen },
  { to: "/admin", label: "Administração", icon: Settings2 },
] as const;

export function AppShell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Link to="/" className="flex items-center gap-2 px-5 py-6">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary text-primary-foreground shadow-glow">
            <Clapperboard className="h-4 w-4" />
          </span>
          <span className="text-lg font-bold tracking-tight">Motion<span className="text-primary">MRO</span></span>
        </Link>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-primary">
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">v1.0 · estúdio IA</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <nav className="flex gap-1 md:hidden">
              {NAV.map((n) => (<Link key={n.to} to={n.to} className="rounded-md p-2 text-muted-foreground data-[status=active]:text-primary" aria-label={n.label}><n.icon className="h-4 w-4" /></Link>))}
            </nav>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
