import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, ArrowRight, Loader2, ShieldCheck, ArrowUpRight, Mail, LockKeyhole, UserRound, Phone, Ticket, Eye, EyeOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/saas.functions";
import { useAccount } from "./AccountProvider";
import { MotionShowcase } from "./MotionShowcase";

export function AuthForm({ mode }: { mode:"login"|"signup"|"admin" }) {
  const nav=useNavigate(); const { refresh }=useAccount();
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [code,setCode]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [message,setMessage]=useState("");
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setBusy(true);setError("");setMessage("");
    try {
      if (mode === "signup") {
        if (name.trim().length<2 || !/^\+?[\d\s()-]{10,20}$/.test(phone)) throw new Error("Preencha seu nome e um WhatsApp válido com DDD.");
        const { data,error:failure }=await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{emailRedirectTo:`${window.location.origin}/auth`,data:{name:name.trim(),whatsapp:phone.replace(/[^+\d]/g,"")}}});
        if (failure) throw failure;
        if (code.trim()) sessionStorage.setItem("motionmro:pending-trial",code.trim());
        if (!data.session) { setMessage("Cadastro recebido. Confirme seu e-mail para entrar; confira também a pasta de spam."); return; }
      } else {
        const { error:failure }=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
        if (failure) throw failure;
      }
      if (mode === "admin" && !(await checkAdmin())) throw new Error("Esta conta não tem permissão administrativa.");
      await refresh(); await nav({to:mode === "admin" ? "/admin/painel" : "/dashboard"});
    } catch(e) { setError(e instanceof Error ? e.message : "Não foi possível entrar."); } finally {setBusy(false);}
  }
  async function reset() {
    if (!email.trim()) {setError("Informe seu e-mail para recuperar a senha.");return;}
    setBusy(true);setError("");
    const { error:failure }=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/reset-password`});
    setBusy(false);if(failure)setError(failure.message);else setMessage("Se o e-mail estiver cadastrado, você receberá o link para definir uma nova senha.");
  }
  const field="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:border-primary";
  if (mode === "admin") return <main className="min-h-screen bg-background px-5 py-8 text-foreground">
    <div className="mx-auto max-w-6xl"><Link to="/" className="inline-flex items-center gap-3 text-xl font-bold"><Clapperboard className="text-primary"/>Motion<span className="text-primary">MRO</span></Link></div>
    <div className="mx-auto mt-12 grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-24">
      <section className="py-4"><span className="font-mono text-xs uppercase tracking-widest text-primary">{"Área restrita"}</span><h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">{"Administração MotionMRO"}</h1><p className="mt-6 max-w-md text-lg text-muted-foreground">{"Clientes, testes, pagamentos e consumo em um único lugar."}</p><div className="mt-8 flex items-center gap-2 text-sm text-accent"><ShieldCheck/>Projetos privados • MP4 disponível por 2 dias</div></section>
      <form onSubmit={submit} className="min-w-0 space-y-5 border-t border-border pt-8 lg:pt-4">
        <h2 className="text-2xl font-semibold">Entrar</h2>
        <label className="block text-sm">E-mail<input required type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} className={field}/></label>
        <label className="block text-sm">Senha<input required type="password" minLength={8} autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} className={field}/></label>
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm text-success">{message}</p>}
        <Button size="lg" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin"/> : <ArrowRight/>}Entrar</Button>
        {<Button type="button" variant="link" onClick={()=>void reset()} disabled={busy}>Esqueci minha senha</Button>}
      </form>
    </div>
  </main>;
  const signup = mode === "signup";
  return <main className="public-experience public-auth min-h-screen text-foreground">
    <nav className="public-wrap relative z-10 flex items-center justify-between gap-3 py-5" aria-label="Navegação principal">
      <Link to="/" className="public-brand"><Clapperboard /><span>Motion<span className="text-primary">MRO</span></span></Link>
      <Button variant="ghost" asChild className="px-2 text-muted-foreground"><Link to="/">Voltar ao início<ArrowUpRight /></Link></Button>
    </nav>
    <div className="public-wrap public-auth-grid relative z-10">
      <section className="public-auth-story">
        <MotionShowcase compact />
        <div className="public-auth-story-copy animate-fade-up">
          <p className="public-eyebrow">Seu espaço para criar o extraordinário</p>
          <h1 className="mt-6 text-5xl font-semibold leading-tight">{signup ? <>Grandes ideias.<br /><span className="text-primary">Novos movimentos.</span></> : <>Sua próxima ideia<br /><span className="text-primary">já tem um estúdio.</span></>}</h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">{signup ? "Da inspiração ao vídeo final, a IA MRO e sua criatividade trabalham juntas. Vamos começar?" : "Seus projetos, suas criações e todas as possibilidades. Bom ter você de volta."}</p>
          <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground"><ShieldCheck className="size-5 text-accent" /><span>Projetos privados. Criatividade sem distrações.</span></div>
        </div>
      </section>
      <form onSubmit={submit} className="public-auth-panel space-y-5">
        <header className="mb-7"><div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase text-accent"><Sparkles className="size-3" />MotionMRO / Seu estúdio</div><h2 className="text-2xl font-semibold">{signup ? "Crie sua conta" : "Entre no seu estúdio"}</h2><p className="mt-2 text-sm text-muted-foreground">{signup ? "O primeiro passo para dar vida às suas ideias." : "Continue de onde a inspiração parou."}</p></header>
        {signup && <div className="grid gap-5 sm:grid-cols-2"><label className="block text-xs font-medium">Nome completo<div className="relative"><UserRound className="public-input-icon" /><input required autoComplete="name" placeholder="Seu nome" value={name} onChange={(e)=>setName(e.target.value)} className="public-auth-input" /></div></label><label className="block text-xs font-medium">WhatsApp com DDD<div className="relative"><Phone className="public-input-icon" /><input required type="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={phone} onChange={(e)=>setPhone(e.target.value)} className="public-auth-input" /></div></label></div>}
        <label className="block text-xs font-medium">E-mail<div className="relative"><Mail className="public-input-icon" /><input required type="email" autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={(e)=>setEmail(e.target.value)} className="public-auth-input" /></div></label>
        <label className="block text-xs font-medium">Senha<div className="relative"><LockKeyhole className="public-input-icon" /><input required type={showPassword ? "text" : "password"} minLength={8} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "Pelo menos 8 caracteres" : "Sua senha"} value={password} onChange={(e)=>setPassword(e.target.value)} className="public-auth-input pr-12" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-3 h-10 text-muted-foreground" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} title={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={()=>setShowPassword(v=>!v)}>{showPassword ? <EyeOff /> : <Eye />}</Button></div></label>
        {signup && <label className="block text-xs font-medium">Código de teste <span className="font-normal text-muted-foreground">(opcional)</span><div className="relative"><Ticket className="public-input-icon" /><input autoComplete="off" placeholder="Insira seu código" value={code} onChange={(e)=>setCode(e.target.value)} className="public-auth-input" /></div><span className="mt-2 block text-[11px] font-normal leading-5 text-muted-foreground">Teste único por IP, com até 90 segundos no total de produções.</span></label>}
        {!signup && <div className="flex justify-end"><Button type="button" variant="link" className="h-auto p-0 text-xs text-muted-foreground" onClick={()=>void reset()} disabled={busy}>Esqueci minha senha</Button></div>}
        {error && <p role="alert" className="break-words rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{message && <p role="status" className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success">{message}</p>}
        <Button size="lg" className="public-cta w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null}{signup ? "Criar minha conta" : "Entrar no estúdio"}{!busy && <ArrowRight />}</Button>
        <p className="border-t border-border pt-5 text-center text-xs text-muted-foreground">{signup ? "Já faz parte? " : "Ainda não tem uma conta? "}<Link to={signup ? "/auth" : "/cadastro"} className="font-medium text-primary hover:underline">{signup ? "Entrar no estúdio" : "Criar minha conta"}</Link></p>
        {signup && <p className="text-center text-[10px] leading-5 text-muted-foreground">Ao continuar, você aceita os <Link to="/privacidade" className="underline underline-offset-2">termos e a política de privacidade</Link>.</p>}
      </form>
    </div>
    <footer className="public-wrap relative z-10 flex flex-wrap justify-between gap-3 border-t border-border py-5 text-[10px] text-muted-foreground"><span>MotionMRO · Inteligência brasileira, ideias em movimento.</span><Link to="/privacidade" className="hover:text-foreground">Termos e privacidade</Link></footer>
  </main>;

}