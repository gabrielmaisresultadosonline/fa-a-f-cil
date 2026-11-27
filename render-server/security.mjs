import { readFile } from "node:fs/promises";
import { join } from "node:path";
export async function authenticate(req) {
  const url=process.env.AUTH_URL, key=process.env.AUTH_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error("Configure AUTH_URL e AUTH_PUBLISHABLE_KEY antes de usar o servidor.");
  const bearer=req.headers.authorization;
  if(typeof bearer!=="string"||!bearer.startsWith("Bearer "))throw new Error("Entre na sua conta para acessar o servidor.");
  const response=await fetch(`${url.replace(/\/+$/,"")}/auth/v1/user`,{headers:{apikey:key,Authorization:bearer},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error("Sessão inválida ou expirada.");
  const user=await response.json();if(!user.id)throw new Error("Sessão inválida.");
  return {id:user.id,bearer};
}
export async function ownedCloudRow(user,table,id) {
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Identificador inválido.");
  const response=await fetch(`${process.env.AUTH_URL}/rest/v1/${table}?id=eq.${id}&user_id=eq.${user.id}&select=*&limit=1`,{headers:{apikey:process.env.AUTH_PUBLISHABLE_KEY,Authorization:user.bearer},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error("Não foi possível verificar a propriedade do pedido.");
  const rows=await response.json();if(!rows[0])throw new Error("Arquivo não pertence à sua conta.");return rows[0];
}
export function assertOwner(owner,user) {if(!owner||owner!==user.id)throw new Error("Arquivo não pertence à sua conta.");}
export async function assertMediaOwner(root,id,user) {const data=JSON.parse(await readFile(join(root,id,"owner.json"),"utf8"));assertOwner(data.user_id,user);}
export function retentionExpired(job,now=Date.now()) {return job.status==="concluido" && Number.isFinite(job.fim) && now>=job.fim+172800000;}
export async function authorizedGeneration(user,projectId) {
  const response=await fetch(`${process.env.AUTH_URL}/rest/v1/generations?project_id=eq.${projectId}&user_id=eq.${user.id}&status=eq.complete&select=id&limit=1`,{headers:{apikey:process.env.AUTH_PUBLISHABLE_KEY,Authorization:user.bearer},signal:AbortSignal.timeout(8000)});
  if(!response.ok||!(await response.json())[0])throw new Error("Este projeto não tem uma produção concluída e autorizada.");
}