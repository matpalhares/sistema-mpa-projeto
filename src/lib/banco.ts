// Camada de dados. Dois modos, escolhidos pelas variáveis de ambiente:
//  - LOCAL (padrão): arquivo dados/banco.json no computador. Não precisa de conta em serviço nenhum.
//  - SUPABASE: quando SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY existem no .env.local.
// Todas as consultas de negócio passam empresaId: é o isolamento por empresa.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Registro = { id: string; empresaId?: string | null; criadoEm?: string; atualizadoEm?: string };

export const PASTA_DADOS = path.resolve(process.env.MPA_PASTA_DADOS || path.join(/* turbopackIgnore: true */ process.cwd(), "dados"));
const ARQ = () => path.join(PASTA_DADOS, "banco.json");

export const usaSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let _sb: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!_sb) _sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return _sb;
}

type Tudo = Record<string, Record<string, Registro>>;
function ler(): Tudo {
  try { return JSON.parse(fs.readFileSync(ARQ(), "utf8")); } catch { return {}; }
}
function gravar(t: Tudo) {
  fs.mkdirSync(PASTA_DADOS, { recursive: true });
  const tmp = ARQ() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(t, null, 1));
  fs.renameSync(tmp, ARQ());
}

export async function listar<T extends Registro>(colecao: string, empresaId?: string): Promise<T[]> {
  if (usaSupabase()) {
    let q = supabase().from("registros").select("dados").eq("colecao", colecao);
    if (empresaId) q = q.eq("empresa_id", empresaId);
    const { data, error } = await q.order("criado_em", { ascending: false });
    if (error) throw new Error("Banco: " + error.message);
    return (data ?? []).map((r) => r.dados as T);
  }
  const itens = Object.values(ler()[colecao] ?? {}) as T[];
  return itens
    .filter((r) => !empresaId || r.empresaId === empresaId)
    .sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? ""));
}

export async function obter<T extends Registro>(colecao: string, id: string, empresaId?: string): Promise<T | null> {
  let r: T | null;
  if (usaSupabase()) {
    const { data, error } = await supabase().from("registros").select("dados").eq("colecao", colecao).eq("id", id).maybeSingle();
    if (error) throw new Error("Banco: " + error.message);
    r = (data?.dados as T) ?? null;
  } else {
    r = (ler()[colecao]?.[id] as T) ?? null;
  }
  if (r && empresaId && r.empresaId !== empresaId) return null; // isolamento por empresa
  return r;
}

export async function salvar<T extends Registro>(colecao: string, registro: Omit<T, "id" | "criadoEm" | "atualizadoEm"> & { id?: string; criadoEm?: string; atualizadoEm?: string }): Promise<T> {
  const agora = new Date().toISOString();
  const r = { ...registro, id: registro.id || randomUUID(), criadoEm: registro.criadoEm || agora, atualizadoEm: agora } as T;
  if (usaSupabase()) {
    const { error } = await supabase().from("registros").upsert({
      id: r.id, colecao, empresa_id: r.empresaId ?? null, dados: r, criado_em: r.criadoEm, atualizado_em: agora,
    }, { onConflict: "colecao,id" });
    if (error) throw new Error("Banco: " + error.message);
    return r;
  }
  const t = ler();
  (t[colecao] ??= {})[r.id] = r;
  gravar(t);
  return r;
}

export async function remover(colecao: string, id: string): Promise<void> {
  if (usaSupabase()) {
    const { error } = await supabase().from("registros").delete().eq("colecao", colecao).eq("id", id);
    if (error) throw new Error("Banco: " + error.message);
    return;
  }
  const t = ler();
  if (t[colecao]) { delete t[colecao][id]; gravar(t); }
}
