import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { planFor } from "./plans";

export async function studioSettings() {
  const { data, error } = await supabaseAdmin.from("app_settings").select("*").eq("id",true).single();
  if (error) throw new Error("Configuração do estúdio indisponível.");
  return data;
}
async function encryptionKey() {
  const value = process.env['MRO_PRIVATE_SETTINGS_KEY'];
  if (!value) throw new Error("Proteção das configurações não disponível.");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt","decrypt"]);
}
export async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(token));
  return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(data)) });
}
export async function openaiToken() {
  const { data } = await supabaseAdmin.from("private_settings").select("openai_encrypted").eq("id",true).single();
  if (!data?.openai_encrypted) throw new Error("A administração precisa configurar a OpenAI antes de iniciar produções.");
  const encrypted = JSON.parse(data.openai_encrypted) as { iv: number[]; data: number[] };
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(encrypted.iv) }, await encryptionKey(), new Uint8Array(encrypted.data)));
}
export async function verifiedPayment(orderId: string, transaction: string, slug: string) {
  const { data: order } = await supabaseAdmin.from("payment_orders").select("*").eq("id",orderId).maybeSingle();
  if (!order) throw new Error("Pedido não encontrado.");
  if (order.status === "paid") return true;
  const settings = await studioSettings();
  const response = await fetch("https://api.checkout.infinitepay.io/payment_check", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ handle: settings.infinite_handle, order_nsu: order.id, transaction_nsu: transaction, slug }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`InfinitePay indisponível (${response.status}). A confirmação será repetida.`);
  const result = await response.json() as { success?: boolean; paid?: boolean; amount?: number };
  if (!result.success || !result.paid) return false;
  const plan = planFor(order.plan);
  if (!plan || result.amount !== order.amount || order.amount !== plan.price*100 || order.credits !== plan.credits) throw new Error("Pagamento incompatível com o pedido.");
  const { error } = await supabaseAdmin.rpc("confirm_order", { p_id: order.id, p_transaction: transaction, p_slug: slug });
  if (error) throw new Error("Não foi possível confirmar este pagamento.");
  return true;
}