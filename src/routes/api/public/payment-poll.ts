import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
const input=z.object({id:z.uuid(),key:z.string().min(32).max(200)});
export const Route=createFileRoute("/api/public/payment-poll")({server:{handlers:{POST:async({request})=>{
  try{const raw=await request.text();if(raw.length>1000)return new Response(null,{status:413});const body=input.parse(JSON.parse(raw));const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(body.key)))).map((b)=>b.toString(16).padStart(2,"0")).join("");
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const {data:key}=await supabaseAdmin.from("payment_check_keys").select("key_hash").eq("order_id",body.id).single();
    if(!key||key.key_hash!==hash)return new Response(null,{status:403});
    const {data:order}=await supabaseAdmin.from("payment_orders").select("status,transaction_nsu,slug,check_until").eq("id",body.id).single();if(!order)return new Response(null,{status:404});if(order.status==="paid")return Response.json({paid:true});if(Date.parse(order.check_until)<Date.now())return Response.json({paid:false,expired:true});if(!order.transaction_nsu||!order.slug)return Response.json({paid:false});
    const {verifiedPayment}=await import("@/lib/saas.server");return Response.json({paid:await verifiedPayment(body.id,order.transaction_nsu,order.slug)});
  }catch{return Response.json({paid:false},{status:400});}
}}}});