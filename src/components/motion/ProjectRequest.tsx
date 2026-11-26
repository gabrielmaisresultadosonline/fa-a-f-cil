import { Link } from "@tanstack/react-router";
import { Copy, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Project } from "@/lib/projects";
import { formatOriginalRequest, originalConfig } from "@/lib/projectBrief";

export function ProjectRequest({ project }: { project: Project }) {
  const c = originalConfig(project);
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success("Pedido copiado"); }
    catch { toast.error("Não foi possível copiar. Selecione o texto do pedido e copie."); }
  }
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline" size="sm"><FileText />Ver pedido completo</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Pedido original</DialogTitle>
          <DialogDescription className="break-words">{project.config.nome}</DialogDescription>
        </DialogHeader>
        <textarea aria-label="Comando original" readOnly value={c.ideia} rows={8} className="w-full min-w-0 resize-y rounded-md border border-input bg-secondary p-3 text-sm leading-relaxed" />
        <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {[
            ["Formato", `${c.largura} × ${c.altura}`], ["Duração", `${c.duracao}s`],
            ["Estilo", c.estilo || "A IA decide"], ["Paleta", c.paleta || "A IA decide"],
            ["Público", c.publico || "A IA decide"], ["Objetivo", c.objetivo || "A IA decide"],
            ["Idioma", c.idioma], ["Velocidade", c.velocidade], ["Intensidade", c.intensidade],
            ["Efeitos sonoros", c.sons ? "Ativados" : "Desativados"], ["Narração", c.voz ? "Ativada" : "Desativada"],
          ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}
        </dl>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => copy(c.ideia)}><Copy />Copiar comando</Button>
          <Button variant="outline" size="sm" onClick={() => copy(formatOriginalRequest(project))}><Copy />Copiar pedido completo</Button>
          <Button size="sm" asChild><Link to="/novo" search={{ origem: project.id }}><Plus />Reutilizar pedido</Link></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}