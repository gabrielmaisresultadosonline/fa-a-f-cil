import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,readFile,readdir,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PaymentChecks } from "./payments.mjs";
test("verificação persiste, recupera após reinício e para ao receber pago",async()=>{
  const root=await mkdtemp(join(tmpdir(),"mro-payments-"));const original=globalThis.fetch;const id=randomUUID();const key=randomUUID()+randomUUID();let paid=false;
  globalThis.fetch=async()=>Response.json({paid});
  try{const first=new PaymentChecks(root,"https://example.com");await first.add(id,key,"cliente");while(first.running)await new Promise((r)=>setTimeout(r,5));const saved=JSON.parse(await readFile(join(root,`${id}.json`),"utf8"));assert.ok(saved.until>Date.now());assert.ok(saved.until<=Date.now()+600000);const recovered=new PaymentChecks(root,"https://example.com");paid=true;await recovered.tick();assert.deepEqual(await readdir(root),[]);}finally{globalThis.fetch=original;await rm(root,{recursive:true,force:true});}
});