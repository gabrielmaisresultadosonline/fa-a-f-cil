import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
const payload=z.object({order_nsu:z.uuid(),transaction_nsu:z.string().min(1).max(150),invoice_slug:z.string().min(1).max(150),amount:z.number().int().positive()});
export const Route=createFileRoute("/api/public/infinitepay")({server:{handlers:{POST:async({request})=>{
  // InfinitePay's documented callback has no signature. It is a notification only;
  // access is NEVER granted until a server-to-server payment_check confirms the order.
  try{const body=await request.text();if(body.length>100000)return new Response("Pedido muito grande",{status:413});const data=payload.parse(JSON.parse(body));const {verifiedPayment}=await import("@/lib/saas.server");const paid=await verifiedPayment(data.order_nsu,data.transaction_nsu,data.invoice_slug);return Response.json({received:true,paid},{status:paid?200:400});}catch{return Response.json({received:false},{status:400});}
}}}});