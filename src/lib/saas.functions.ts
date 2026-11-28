import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader,getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planFor, PAYMENT_WINDOW_MS } from "./plans";
import type { Json } from "@/integrations/supabase/types";

export const checkAdmin = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return !error && data === true;
});
export const accountInfo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [profile,account,admin] = await Promise.all([context.supabase.from("profiles").select("*").eq("id", context.userId).single(),context.supabase.from("saas_accounts").select("*").eq("user_id",context.userId).single(),context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"})]);
  if (profile.error || account.error) throw new Error("Não foi possível carregar sua conta.");
  return { profile: profile.data, account: account.data, admin: admin.data === true };
});
export const redeemTrial = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ code:z.string().trim().min(4).max(64) })).handler(async ({ data,context }) => {
  // Only the platform-provided client IP is trusted, never user input or x-forwarded-for.
  const ip = getRequestHeader("cf-connecting-ip") || (getRequestUrl().hostname === "localhost" && process.env['NODE_ENV'] !== "production" ? "127.0.0.1" : undefined);
  if (!ip) throw new Error("A validação de IP exige o endereço público do aplicativo; teste local não resgata códigos.");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`motionmro-trial:${ip}`));
  const ipHash = Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2,"0")).join("");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("claim_trial", { p_user:context.userId,p_code:data.code,p_ip:ipHash });
  if (error) throw new Error(error.message);
  return { ok:true };
});
export const reserveGeneration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ projectId:z.uuid(),seconds:z.number().int().min(1).max(600) })).handler(async ({ data,context }) => {
  const { data: project,error } = await context.supabase.from("customer_projects").select("id,data,kind").eq("id",data.projectId).eq("user_id",context.userId).single();
  if (error || !project || !["motion","overlay"].includes(project.kind)) throw new Error("Projeto não encontrado.");
  const document=project.data;
  if(!document||typeof document!=="object"||Array.isArray(document))throw new Error("Projeto inválido.");
  const config=document['config'];
  const duration=project.kind==="motion" && config && typeof config==="object" && !Array.isArray(config)?config['duracao']:document['duracao'];
  if(typeof duration!=="number"||Math.ceil(duration)!==data.seconds)throw new Error("A duração deve corresponder ao projeto salvo.");
  const {openaiToken}=await import("./saas.server");await openaiToken();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data:id,error:failure } = await supabaseAdmin.rpc("reserve_generation", { p_user:context.userId,p_project:data.projectId,p_seconds:data.seconds });
  if (failure) throw new Error(failure.message);
  return { id };
});
export const completeGeneration = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ projectId:z.uuid() })).handler(async ({ data,context }) => {
  const { data:project } = await context.supabase.from("customer_projects").select("data").eq("id",data.projectId).eq("user_id",context.userId).single();
  if (!project || !project.data || typeof project.data !== "object" || Array.isArray(project.data) || project.data['status'] !== "pronto") throw new Error("Salve a prévia concluída antes de finalizar.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("finish_generation",{ p_user:context.userId,p_project:data.projectId,p_failed:false });
  if (error) throw error;
});
export const createCheckout = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ plan:z.enum(["starter","creator","pro","agency"]),origin:z.url().max(300) })).handler(async ({ data,context }) => {
  const origin = new URL(data.origin);
  const host = getRequestHeader("origin");
  if (!host || origin.origin !== host || origin.pathname !== "/") throw new Error("Endereço de retorno inválido.");
  const { studioSettings } = await import("./saas.server");
  const settings = await studioSettings();
  if (!settings.sales_enabled) throw new Error("As vendas estão desativadas no momento.");
  const plan = planFor(data.plan); if (!plan) throw new Error("Plano inválido.");
  const { data:profile } = await context.supabase.from("profiles").select("*").eq("id",context.userId).single();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data:order,error } = await supabaseAdmin.from("payment_orders").insert({ user_id:context.userId,plan:plan.id,credits:plan.credits,amount:plan.price*100,check_until:new Date(Date.now()+PAYMENT_WINDOW_MS).toISOString() }).select("id").single();
  if (error) throw new Error("Não foi possível criar o pedido.");
  const response = await fetch("https://api.checkout.infinitepay.io/links", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ handle:settings.infinite_handle,order_nsu:order.id,items:[{quantity:1,price:plan.price*100,description:`MotionMRO ${plan.name} — ${plan.credits} créditos`}],redirect_url:`${origin.origin}/pagamento`,webhook_url:`${origin.origin}/api/public/infinitepay`,customer:{name:profile?.name,email:profile?.email,phone_number:profile?.whatsapp} }),signal:AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`InfinitePay não criou o pagamento (${response.status}).`);
  const result = await response.json() as { url?:string };
  if (!result.url || !result.url.startsWith("https://")) throw new Error("A InfinitePay não retornou um link válido.");
  const { error:saveError } = await supabaseAdmin.from("payment_orders").update({checkout_url:result.url}).eq("id",order.id);
  if (saveError) throw new Error("Não foi possível guardar o link de pagamento.");
  const pollKey=crypto.randomUUID()+crypto.randomUUID();
  const keyHash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pollKey)))).map((b)=>b.toString(16).padStart(2,"0")).join("");
  const {error:keyError}=await supabaseAdmin.from("payment_check_keys").insert({order_id:order.id,key_hash:keyHash});
  if(keyError)throw new Error("Não foi possível preparar o acompanhamento de pagamento.");
  return { url:result.url,id:order.id,pollKey };
});
export const checkCheckout = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id:z.uuid(),transaction:z.string().min(1).max(150),slug:z.string().min(1).max(150) })).handler(async ({ data,context }) => {
  const { data:order } = await context.supabase.from("payment_orders").select("id").eq("id",data.id).eq("user_id",context.userId).single();
  if (!order) throw new Error("Pedido não encontrado.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("payment_orders").update({transaction_nsu:data.transaction,slug:data.slug}).eq("id",order.id).neq("status","paid");
  const { verifiedPayment } = await import("./saas.server");
  return { paid:await verifiedPayment(data.id,data.transaction,data.slug) };
});
const adminInput = z.object({ action:z.enum(["read","settings","code","toggle_code"]),page:z.number().int().min(0).max(100000).default(0),code:z.string().max(64).optional(),codeId:z.uuid().optional(),enabled:z.boolean().optional(),token:z.string().max(500).optional(),sales:z.boolean().optional(),renderUrl:z.string().max(300).optional(),engine:z.enum(["ffmpeg","hyperframes"]).optional(),handle:z.string().min(1).max(80).optional(),model:z.string().min(1).max(80).optional(),prices:z.record(z.string(),z.unknown()).optional() });
export const adminAction = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth]).inputValidator(adminInput).handler(async ({ data,context }) => {
  const { data:admin } = await context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"});
  if (!admin) throw new Error("Acesso exclusivo da administração.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (data.action === "code") {
    const code = (data.code || `MRO-${crypto.randomUUID().slice(0,8)}`).trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,64}$/.test(code)) throw new Error("Código: 4 a 64 letras, números ou hífens.");
    const { error } = await supabaseAdmin.from("trial_codes").insert({ code }); if (error) throw new Error("Código já existe ou não pôde ser criado.");
  }
  if (data.action === "toggle_code") {
    if (!data.codeId || data.enabled === undefined) throw new Error("Código inválido.");
    const { error } = await supabaseAdmin.from("trial_codes").update({enabled:data.enabled}).eq("id",data.codeId); if (error) throw error;
  }
  if (data.action === "settings") {
    if (data.renderUrl && !/^https?:\/\//.test(data.renderUrl)) throw new Error("Endereço do servidor inválido.");
    const { error } = await supabaseAdmin.from("app_settings").update({ ...(data.sales !== undefined ? {sales_enabled:data.sales}:{}),...(data.renderUrl !== undefined ? {render_url:data.renderUrl}:{}),...(data.engine ? {render_engine:data.engine}:{}),...(data.handle ? {infinite_handle:data.handle}:{}),...(data.model ? {model:data.model}:{}),...(data.prices ? {prices:data.prices as Json}:{}) }).eq("id",true);
    if (error) throw error;
    if (data.token?.trim()) { const { encryptToken } = await import("./saas.server"); const { error:failure } = await supabaseAdmin.from("private_settings").update({openai_encrypted:await encryptToken(data.token.trim())}).eq("id",true); if (failure) throw failure; }
  }
  const from=data.page*25;
  const [profiles,codes,orders,usage,summary,settings,tokenStatus] = await Promise.all([
    context.supabase.from("profiles").select("*,saas_accounts(*)",{count:"exact"}).order("created_at",{ascending:false}).range(from,from+24),
    context.supabase.from("trial_codes").select("*,trial_claims(id)").order("created_at",{ascending:false}).limit(100),
    context.supabase.from("payment_orders").select("*,profiles(name,email)").order("created_at",{ascending:false}).range(from,from+24),
    context.supabase.from("usage_costs").select("*,profiles(name,email),generations(trial),customer:project_id").order("created_at",{ascending:false}).range(from,from+24),
    context.supabase.rpc("admin_summary"),context.supabase.from("app_settings").select("*").eq("id",true).single(),supabaseAdmin.from("private_settings").select("openai_encrypted").eq("id",true).single(),
  ]);
  if (profiles.error || codes.error || orders.error || usage.error || settings.error) throw new Error("Não foi possível carregar a administração.");
  const [customerCosts,totals]=await Promise.all([context.supabase.rpc("admin_customer_costs",{p_offset:from}),context.supabase.rpc("admin_cost_totals")]);
  return { profiles:profiles.data,count:profiles.count ?? 0,codes:codes.data,orders:orders.data,usage:usage.data,summary:summary.data,customerCosts:customerCosts.data??[],totals:totals.data,settings:settings.data,tokenConfigured:!!tokenStatus.data?.openai_encrypted };
});