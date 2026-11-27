import { test } from "node:test";
import assert from "node:assert/strict";
import { assertOwner,retentionExpired } from "./security.mjs";
test("um cliente não pode acessar um render de outro",()=>{assert.throws(()=>assertOwner("cliente-a",{id:"cliente-b"}));assert.doesNotThrow(()=>assertOwner("cliente-a",{id:"cliente-a"}));});
test("renders antigos sem proprietário não ficam públicos",()=>assert.throws(()=>assertOwner(undefined,{id:"cliente-a"})));
test("MP4 expira exatamente após dois dias, não antes",()=>{const job={status:"concluido",fim:1000};assert.equal(retentionExpired(job,172800999),false);assert.equal(retentionExpired(job,172801000),true);});
test("retenção não remove renderizações em andamento",()=>assert.equal(retentionExpired({status:"renderizando",fim:0},999999999),false));