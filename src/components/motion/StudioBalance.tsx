import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ticket, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAccount } from "./AccountProvider";
import { redeemTrial } from "@/lib/saas.functions";
export function StudioBalance() {
  const {info,sales,refresh}=useAccount();const [code,setCode]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{setCode(sessionStorage.getItem("motionmro:pending-trial") || "");},[]);
  async function redeem(){setBusy(true);try{await redeemTrial({data:{code}});sessionStorage.removeItem("motionmro:pending-trial");setCode("");await refresh();toast.success("Teste ativado: 90 segundos para suas produções.");}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível ativar o teste.");}finally{setBusy(false);}}
  return <section className="mb-6 flex flex-wrap items-center gap-5 border-b border-border pb-5">
    <div className="mr-auto"><p className="text-sm text-muted-foreground">{info?.profile.name || "Seu estúdio"}</p><p className="text-lg font-semibold">{info?.admin ? "Conta administrativa" : `${info?.account.credits ?? 0} créditos • ${info?.account.trial_seconds ?? 0}s de teste disponíveis`}</p></div>
    {!info?.admin && <div className="flex max-w-full flex-wrap gap-2"><input aria-label="Código de teste" value={code} onChange={(e)=>setCode(e.target.value)} placeholder="Código de teste" className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm"/><Button variant="outline" disabled={busy||code.trim().length<4} onClick={()=>void redeem()}><Ticket/>{busy?"Ativando…":"Ativar teste"}</Button></div>}
    {sales && <Button asChild><Link to="/planos">Escolher plano<ArrowRight/></Link></Button>}
  </section>;
}