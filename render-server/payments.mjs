import { mkdir, readdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { validJobId } from "./jobs.mjs";
export class PaymentChecks {
  constructor(root,origin){this.root=root;this.origin=origin;this.running=false;this.timer=null;}
  async init(){await mkdir(this.root,{recursive:true});void this.tick();this.timer=setInterval(()=>void this.tick(),15000);this.timer.unref();}
  async add(id,key,userId){if(!validJobId(id)||typeof key!=="string"||key.length<32||key.length>200)throw new Error("Pedido inválido.");const file=join(this.root,`${id}.json`);try{const old=JSON.parse(await readFile(file,"utf8"));if(old.userId!==userId)throw new Error("Pedido de outro cliente.");return;}catch(e){if(e.code!=="ENOENT")throw e;}await writeFile(`${file}.tmp`,JSON.stringify({id,key,userId,until:Date.now()+600000}),{mode:0o600});await rename(`${file}.tmp`,file);void this.tick();}
  async tick(){if(this.running)return;this.running=true;try{for(const file of await readdir(this.root)){if(!file.endsWith(".json"))continue;const path=join(this.root,file);try{const task=JSON.parse(await readFile(path,"utf8"));if(Date.now()>task.until){await rm(path);continue;}const r=await fetch(`${this.origin}/api/public/payment-poll`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:task.id,key:task.key}),signal:AbortSignal.timeout(10000)});if(r.ok&&(await r.json()).paid)await rm(path);}catch{/* Keeps persisted job for the next attempt; never logs credentials. */}}}finally{this.running=false;}}
}