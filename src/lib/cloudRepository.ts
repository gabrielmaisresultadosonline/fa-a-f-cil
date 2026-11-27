import { createId } from "./uuid";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type Kind = "motion" | "overlay" | "editor" | "job";
async function owner() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Entre na sua conta para acessar seus projetos.");
  return data.user.id;
}
// Every blob is private and owned by the same account as its project.
async function pack(value: unknown, prefix: string): Promise<Json> {
  if (value instanceof Blob) {
    const path = `${prefix}/${createId()}`;
    const { error } = await supabase.storage.from("customer-assets").upload(path, value, { contentType: value.type || "application/octet-stream" });
    if (error) throw error;
    return { __asset: path, mime: value.type };
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => pack(v, prefix)));
  if (value && typeof value === "object") {
    const result: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) result[k] = await pack(v, prefix);
    return result;
  }
  return value === undefined ? null : value as Json;
}
async function unpack(value: Json): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map(unpack));
  if (value && typeof value === "object") {
    if (typeof value['__asset'] === "string") {
      const { data, error } = await supabase.storage.from("customer-assets").download(value['__asset']);
      if (error || !data) throw new Error("Não foi possível recuperar o arquivo privado.");
      blobPaths.set(data,value['__asset']);
      return data;
    }
    return Object.fromEntries(await Promise.all(Object.entries(value).filter((entry): entry is [string, Json] => entry[1] !== undefined).map(async ([k, v]) => [k, await unpack(v)])));
  }
  return value;
}
// Serialize writes per entity; queued edits cannot overwrite a later save.
const writes = new Map<string, Promise<void>>();
const blobPaths = new WeakMap<Blob, string>();
async function packCached(value: unknown, prefix: string): Promise<Json> {
  if (value instanceof Blob) {
    const cached = blobPaths.get(value);
    if (cached) return { __asset: cached, mime: value.type };
    const packed = await pack(value, prefix);
    if (packed && typeof packed === "object" && !Array.isArray(packed) && typeof packed['__asset'] === "string") blobPaths.set(value, packed['__asset']);
    return packed;
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => packCached(v, prefix)));
  if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).filter(([,v]) => v !== undefined).map(async ([k,v]) => [k, await packCached(v,prefix)])));
  return value === undefined ? null : value as Json;
}
export async function saveCloud(kind: Kind, id: string, name: string, value: unknown) {
  const previous = writes.get(id) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const userId = await owner();
    const data = await packCached(value, `${userId}/${id}`);
    const { error } = await supabase.from("customer_projects").upsert({ id, kind, name, data, user_id: userId, updated_at: new Date().toISOString() });
    if (error) throw error;
  });
  writes.set(id, task);
  try { await task; } finally { if (writes.get(id) === task) writes.delete(id); }
}
export async function getCloud<T>(kind: Kind, id: string): Promise<T | null> {
  const userId = await owner();
  const { data, error } = await supabase.from("customer_projects").select("data").eq("id", id).eq("kind", kind).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? await unpack(data.data) as T : null;
}
export async function listCloud<T>(kind: Kind): Promise<T[]> {
  const userId = await owner();
  const { data, error } = await supabase.from("customer_projects").select("data").eq("kind", kind).eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return Promise.all((data ?? []).map(async (row) => await unpack(row.data) as T));
}
export async function deleteCloud(kind: Kind, id: string) {
  const userId = await owner();
  const { error } = await supabase.from("customer_projects").delete().eq("id", id).eq("kind", kind).eq("user_id", userId);
  if (error) throw error;
}