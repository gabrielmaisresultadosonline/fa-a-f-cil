import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clapperboard, Sparkles, Layers, AudioLines, Film, ArrowRight, Check, ShieldCheck, Play, MoveUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionShowcase } from "@/components/motion/MotionShowcase";
import { useAccount } from "@/components/motion/AccountProvider";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/")({
  head: () => pageHead("IA brasileira para vídeos", "Transforme suas ideias em vídeos com a IA MRO: direção criativa, roteiro, motion, efeitos, edição e MP4."),
  component: Sales,
});

function Sales() {
  const { info } = useAccount();
  const start = info ? "/dashboard" : "/cadastro";
  return <main className="public-experience min-h-screen text-foreground">
    <nav className="public-wrap flex items-center justify-between gap-3 py-5" aria-label="Navegação principal">
      <Link to="/" className="public-brand"><Clapperboard /><span>Motion<span className="text-primary">MRO</span></span></Link>
      <div className="flex items-center gap-1 sm:gap-4"><Button variant="ghost" asChild><Link to="/planos">Planos</Link></Button><Button variant="outline" asChild><Link to={info ? "/dashboard" : "/auth"}>{info ? "Meu estúdio" : "Entrar"}<ArrowUpRight /></Link></Button></div>
    </nav>
    <section className="public-hero">
      <MotionShowcase />
      <div className="public-wrap relative z-10 flex h-full items-center py-12 md:py-20">
        <div className="max-w-xl animate-fade-up">
          <p className="public-eyebrow">Inteligência brasileira. Liberdade criativa.</p>
          <h1 className="public-title mt-7">MotionMRO<span className="mt-3 block text-primary">Sua ideia.<br />Em movimento.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">Do primeiro insight ao vídeo final. Mais de 5 agentes de IA criam roteiro, cenas e movimento para sua mensagem ganhar a atenção que merece.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg" className="public-cta"><Link to={start}>Começar meu vídeo<ArrowRight /></Link></Button><Button asChild size="lg" variant="outline" className="h-12 px-5"><Link to="/planos">Ver planos<ArrowUpRight /></Link></Button></div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-accent" />Seu estúdio privado</span><span className="flex items-center gap-2"><Check className="size-4 text-primary" />Teste com seu código</span></div>
        </div>
      </div>
    </section>
    <section className="public-wrap grid grid-cols-2 gap-x-6 gap-y-7 border-b border-border py-9 md:grid-cols-4" aria-label="O estúdio em números">
      {[["6+", "especialidades de IA"], ["Motion + Overlay", "criatividade em dois modos"], ["MP4", "pronto para publicar"], ["100% seu", "projetos privados"]].map(([value, label]) => <div key={value}><p className="text-xl font-semibold sm:text-2xl">{value}<span className="text-primary">.</span></p><p className="mt-2 text-xs text-muted-foreground sm:text-sm">{label}</p></div>)}
    </section>
    <section className="public-wrap py-16 md:py-24">
      <header className="flex flex-wrap items-end justify-between gap-6"><div><p className="public-eyebrow">Da ideia à última cena</p><h2 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl">Um estúdio completo.<br /><span className="text-muted-foreground">Um novo jeito de criar.</span></h2></div><p className="max-w-xs text-sm leading-6 text-muted-foreground">Para campanhas, conteúdos e marcas que não querem passar despercebidos.</p></header>
      <div className="mt-12 grid gap-x-14 gap-y-4 md:grid-cols-2">
        {[{ icon: Sparkles, title: "Motion com personalidade", text: "Direção criativa, tipografia em movimento, gráficos e transições. Sua mensagem vira uma produção com identidade." }, { icon: Layers, title: "Seu vídeo, mais impactante", text: "O Video Overlay acompanha sua fala e destaca palavras, números e mensagens exatamente no momento certo." }, { icon: AudioLines, title: "O toque final é seu", text: "Adicione música, grave sua voz, corte as faixas e ajuste o som. Deixe cada detalhe do seu jeito." }, { icon: Film, title: "Renderize. Volte. Baixe.", text: "Depois do envio confirmado, seu vídeo continua renderizando mesmo com a janela fechada. Baixe o MP4 em até dois dias." }].map((item, i) => <article key={item.title} className="public-feature"><div className="flex items-center justify-between"><item.icon className="size-7 text-accent" /><span className="font-mono text-xs text-muted-foreground">0{i + 1}</span></div><h3 className="mt-5 text-xl font-semibold">{item.title}</h3><p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">{item.text}</p></article>)}
      </div>
    </section>
    <section className="relative overflow-hidden border-y border-border bg-card">
      <div className="public-wrap relative flex flex-wrap items-center justify-between gap-8 py-14 md:py-20"><div><p className="public-eyebrow"><Play className="size-3" />O próximo play é seu</p><h2 className="mt-5 text-3xl font-semibold sm:text-4xl">Coloque sua ideia em cena.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Crie sua conta, ative seu código de teste de até 90 segundos ou escolha um pacote de créditos.</p></div><Button asChild size="lg" className="public-cta"><Link to={start}>Criar meu primeiro vídeo<MoveUpRight /></Link></Button></div>
    </section>
    <footer className="public-wrap flex flex-wrap items-center justify-between gap-5 py-8"><Link to="/" className="public-brand"><Clapperboard /><span>Motion<span className="text-primary">MRO</span></span></Link><span className="text-xs text-muted-foreground">Feito no Brasil. Criado para suas ideias.</span><Link to="/privacidade" className="text-xs text-muted-foreground hover:text-foreground">Termos e privacidade<ArrowUpRight className="ml-1 inline size-3" /></Link></footer>
  </main>;
}
