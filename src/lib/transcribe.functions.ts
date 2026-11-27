import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const transcribeAudio=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:FormData)=>{
  if(!(input instanceof FormData))throw new Error("Áudio inválido.");
  const file=input.get("file"),id=input.get("projectId");
  if(!(file instanceof Blob)||file.size>25*1024*1024||file.size<44||typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Áudio ou projeto inválido.");
  return input;
}).handler(async({data,context})=>{
  const projectId=String(data.get("projectId"));const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data:generationId,error:denied}=await supabaseAdmin.rpc("generation_call",{p_user:context.userId,p_project:projectId});if(denied)throw new Error(denied.message);
  const {openaiToken}=await import("./saas.server");const token=await openaiToken();const file=data.get("file");if(!(file instanceof Blob))throw new Error("Áudio inválido.");
  const form=new FormData();form.append("file",file,"audio.wav");form.append("model","whisper-1");form.append("response_format","verbose_json");form.append("timestamp_granularities[]","segment");
  const response=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:`Bearer ${token}`},body:form});
  if(!response.ok){await supabaseAdmin.rpc("finish_generation",{p_user:context.userId,p_project:projectId,p_failed:true});throw new Error(`Transcrição indisponível (${response.status}). A reserva foi devolvida.`);}
  const result=await response.json() as {duration?:number;segments?:{start:number;end:number;text:string}[]};
  const duration=result.duration??Math.max(0,(file.size-44)/32000);
  const {error}=await supabaseAdmin.from("usage_costs").insert({user_id:context.userId,project_id:projectId,generation_id:generationId,kind:"transcricao",stage:"Transcrição",model:"whisper-1",units:duration/60});if(error)throw new Error("Não foi possível registrar o custo da transcrição.");
  return (result.segments??[]).map((s)=>({inicio:s.start,fim:s.end,texto:s.text}));
});