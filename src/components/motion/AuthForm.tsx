import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/saas.functions";
import { useAccount } from "./AccountProvider";

export function AuthForm({ mode }: { mode:"login"|"signup"|"admin" }) {
  const nav=useNavigate(); const { refresh }=useAccount();
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [code,setCode]=useState("");
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
  return <main className="min-h-screen bg-background px-5 py-8 text-foreground">
    <div className="mx-auto max-w-6xl"><Link to="/" className="inline-flex items-center gap-3 text-xl font-bold"><Clapperboard className="text-primary"/>Motion<span className="text-primary">MRO</span></Link></div>
    <div className="mx-auto mt-12 grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-24">
      <section className="py-4"><span className="font-mono text-xs uppercase tracking-widest text-primary">{mode === "admin" ? "Área restrita" : "Estúdio brasileiro de vídeo com IA"}</span><h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">{mode === "admin" ? "Administração MotionMRO" : mode === "signup" ? "Seu próximo vídeo começa aqui." : "Bem-vindo ao seu estúdio."}</h1><p className="mt-6 max-w-md text-lg text-muted-foreground">{mode === "admin" ? "Clientes, testes, pagamentos e consumo em um único lugar." : "Ideias ganham movimento. Projetos, prévias e edição, no seu espaço privado."}</p><div className="mt-8 flex items-center gap-2 text-sm text-accent"><ShieldCheck/>Projetos privados • MP4 disponível por 2 dias</div></section>
      <form onSubmit={submit} className="min-w-0 space-y-5 border-t border-border pt-8 lg:pt-4">
        <h2 className="text-2xl font-semibold">{mode === "signup" ? "Criar minha conta" : "Entrar"}</h2>
        {mode === "signup" && <><label className="block text-sm">Nome completo<input required autoComplete="name" value={name} onChange={(e)=>setName(e.target.value)} className={field}/></label><label className="block text-sm">WhatsApp com DDD<input required type="tel" autoComplete="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} className={field}/></label></>}
        <label className="block text-sm">E-mail<input required type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} className={field}/></label>
        <label className="block text-sm">Senha<input required type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e)=>setPassword(e.target.value)} className={field}/></label>
        {mode === "signup" && <label className="block text-sm">Código de teste <span className="text-muted-foreground">(opcional)</span><input autoComplete="off" value={code} onChange={(e)=>setCode(e.target.value)} className={field}/><span className="mt-2 block text-xs text-muted-foreground">Teste único por IP. Até 90 segundos no total de produções.</span></label>}
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm text-success">{message}</p>}
        <Button size="lg" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin"/> : <ArrowRight/>}{mode === "signup" ? "Criar conta" : "Entrar"}</Button>
        {mode !== "signup" && <Button type="button" variant="link" onClick={()=>void reset()} disabled={busy}>Esqueci minha senha</Button>}
        {mode !== "admin" && <p className="text-sm text-muted-foreground">{mode === "signup" ? "Já tem uma conta? " : "Ainda não tem conta? "}<Link to={mode === "signup" ? "/auth" : "/cadastro"} className="text-primary">{mode === "signup" ? "Entrar" : "Cadastrar"}</Link></p>}
        {mode === "signup" && <p className="text-xs text-muted-foreground">Ao cadastrar, você aceita os <Link to="/privacidade" className="underline">termos e a política de privacidade</Link>.</p>}
      </form>
    </div>
  </main>;
}