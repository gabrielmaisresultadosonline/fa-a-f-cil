import { supabase } from "@/integrations/supabase/client";
export async function renderHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Entre na sua conta para acessar a renderização.");
  return { Authorization:`Bearer ${data.session.access_token}` };
}
export async function renderFetch(url:string,init?:RequestInit) {
  const headers=new Headers(init?.headers);
  const auth=await renderHeaders(); headers.set("Authorization",auth.Authorization);
  return fetch(url,{...init,headers});
}
export async function renderDownload(url:string,name:string) {
  const response=await renderFetch(url);
  if (!response.ok) throw new Error(response.status===410 ? "Este MP4 expirou após dois dias. Renderize novamente." : "Não foi possível baixar o arquivo.");
  const blob=await response.blob(); const href=URL.createObjectURL(blob); const link=document.createElement("a"); link.href=href; link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(href),10000);
}