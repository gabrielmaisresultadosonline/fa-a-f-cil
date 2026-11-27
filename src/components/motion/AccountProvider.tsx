import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { accountInfo } from "@/lib/saas.functions";
import { setPublicSettings, type Precos } from "@/lib/settings";

type Info = Awaited<ReturnType<typeof accountInfo>>;
type AccountState = { info:Info|null; loading:boolean; sales:boolean; refresh:()=>Promise<void>; signOut:()=>Promise<void> };
const AccountContext = createContext<AccountState>({info:null,loading:true,sales:false,refresh:async()=>{},signOut:async()=>{}});
export const useAccount = () => useContext(AccountContext);
export function AccountProvider({ children }: { children:ReactNode }) {
  const router=useRouter(); const [info,setInfo]=useState<Info|null>(null); const [loading,setLoading]=useState(true); const [sales,setSales]=useState(false);
  const refresh=useCallback(async()=>{
    try {
      const { data:user }=await supabase.auth.getUser();
      const { data:settings }=await supabase.from("app_settings").select("*").eq("id",true).single();
      if (settings) { setSales(settings.sales_enabled); setPublicSettings({ servidor:settings.render_url || "http://localhost:4400",modelo:settings.model,precos:settings.prices as unknown as Precos }); }
      setInfo(user.user ? await accountInfo() : null);
    } catch { setInfo(null); } finally { setLoading(false); }
  },[]);
  useEffect(()=>{ void refresh(); },[refresh]);
  // One identity subscriber for the whole app; never refetch protected state on sign-out.
  useEffect(()=>{
    const { data:{subscription} }=supabase.auth.onAuthStateChange((event)=>{
      if (!["SIGNED_IN","SIGNED_OUT","USER_UPDATED"].includes(event)) return;
      if (event === "SIGNED_OUT") { setInfo(null); setLoading(false); void router.invalidate(); return; }
      // Supabase callback must not await additional auth calls inside its lock.
      setTimeout(()=>{ void refresh(); void router.invalidate(); void router.options.context.queryClient.invalidateQueries(); },0);
    });
    return ()=>subscription.unsubscribe();
  },[refresh,router]);
  const signOut=async()=>{
    await router.options.context.queryClient.cancelQueries(); router.options.context.queryClient.clear();
    await supabase.auth.signOut(); setInfo(null); await router.navigate({to:"/auth",replace:true});
  };
  return <AccountContext.Provider value={{info,loading,sales,refresh,signOut}}>{children}</AccountContext.Provider>;
}