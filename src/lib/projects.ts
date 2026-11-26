import { get, set, del, keys } from "idb-keyval";

export type AgentKey = "diretor" | "roteirista" | "desenvolvedor" | "validador";
export type AgentStatus = "aguardando" | "executando" | "concluido" | "erro";

export interface Scene {
  id: string;
  titulo: string;
  duracao: number;
  textoPrincipal: string;
  textoSecundario?: string;
  descricaoVisual: string;
  animacao: string;
  transicaoEntrada: string;
  transicaoSaida: string;
  html?: string;
}

export interface ProjectConfig {
  nome: string;
  ideia: string;
  duracao: number;
  largura: number;
  altura: number;
  estilo: string;
  paleta: string;
  publico: string;
  objetivo: string;
  idioma: string;
  velocidade: string;
  intensidade: string;
}

export interface Project {
  id: string;
  criadoEm: number;
  atualizadoEm: number;
  config: ProjectConfig;
  direcao?: string;
  cenas: Scene[];
  agentes: Record<AgentKey, AgentStatus>;
  log: { t: number; agente: string; msg: string }[];
  status: "rascunho" | "produzindo" | "pronto" | "erro";
}

const PREFIX = "project:";

export async function saveProject(p: Project) {
  p.atualizadoEm = Date.now();
  await set(PREFIX + p.id, p);
}
export async function getProject(id: string) {
  return (await get<Project>(PREFIX + id)) ?? null;
}
export async function deleteProject(id: string) {
  await del(PREFIX + id);
}
export async function listProjects() {
  const ks = (await keys()).filter((k) => String(k).startsWith(PREFIX));
  const all = await Promise.all(ks.map((k) => get<Project>(k)));
  return all.filter(Boolean).sort((a, b) => b!.atualizadoEm - a!.atualizadoEm) as Project[];
}

export const FORMATOS = [
  { label: "Stories / Reels", w: 1080, h: 1920 },
  { label: "Instagram Feed", w: 1080, h: 1350 },
  { label: "Quadrado", w: 1080, h: 1080 },
  { label: "Full HD", w: 1920, h: 1080 },
  { label: "QHD", w: 2560, h: 1440 },
  { label: "4K", w: 3840, h: 2160 },
];

export const AGENTES: { key: AgentKey; nome: string; desc: string }[] = [
  { key: "diretor", nome: "Diretor Criativo", desc: "Conceito, cores, tipografia e estilo" },
  { key: "roteirista", nome: "Roteirista", desc: "Narrativa dividida em cenas" },
  { key: "desenvolvedor", nome: "Dev. de Motion", desc: "Código HTML/CSS/JS de cada cena" },
  { key: "validador", nome: "Validador", desc: "Confere o código e as durações" },
];

export function buildFullHtml(p: Project) {
  const { largura: w, altura: h } = p.config;
  const scenes = p.cenas.filter((c) => c.html);
  const data = JSON.stringify(scenes.map((c) => ({ d: c.duracao, html: c.html })));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${p.config.nome}</title>
<style>html,body{margin:0;background:#000;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden}
#s{width:${w}px;height:${h}px;transform-origin:center;border:0}</style></head><body>
<iframe id="s"></iframe><script>
const S=${data.replace(/<\/script/gi, "<\\/script")};let i=0;const f=document.getElementById('s');
function fit(){const k=Math.min(innerWidth/${w},innerHeight/${h});f.style.transform='scale('+k+')'}
addEventListener('resize',fit);fit();
function play(){f.srcdoc=S[i].html;setTimeout(()=>{i=(i+1)%S.length;play()},S[i].d*1000)}play();
</script></body></html>`;
}
