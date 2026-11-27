import { get, keys } from "idb-keyval";
import { saveCloud } from "./cloudRepository";
// Explicit administrator action only; never auto-assign an old browser's data to a customer.
export async function importLegacyProjects() {
  let count=0;
  for(const key of await keys()){
    const value=String(key);const kind=value.startsWith("project:")?"motion":value.startsWith("overlay:")?"overlay":value.startsWith("editor:")?"editor":null;
    if(!kind)continue;const record=await get<Record<string,unknown>>(key);if(!record||typeof record['id']!=="string")continue;
    const config=record['config'];const name=typeof record['nome']==="string"?record['nome']:config&&typeof config==="object"&&"nome" in config?String(config.nome):"Projeto importado";
    await saveCloud(kind,record['id'],name,record);count++;
  }
  return count;
}