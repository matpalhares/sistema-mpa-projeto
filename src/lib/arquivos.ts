// Arquivos (plantas, documentos gerados). Local: pasta dados/arquivos. Supabase: bucket "arquivos".
import fs from "node:fs";
import path from "node:path";
import { PASTA_DADOS, supabase, usaSupabase } from "./banco";

const RAIZ = () => path.join(PASTA_DADOS, "arquivos");
const BUCKET = "arquivos";

export function nomeSeguro(nome: string) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);
}

function localSeguro(caminho: string) {
  const p = path.resolve(RAIZ(), caminho);
  if (!p.startsWith(RAIZ() + path.sep)) throw new Error("Caminho inválido");
  return p;
}

export async function salvarArquivo(caminho: string, conteudo: Buffer, tipo = "application/octet-stream") {
  if (usaSupabase()) {
    const { error } = await supabase().storage.from(BUCKET).upload(caminho, conteudo, { upsert: true, contentType: tipo });
    if (error) throw new Error("Arquivos: " + error.message);
    return;
  }
  const p = localSeguro(caminho);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, conteudo);
}

export async function lerArquivo(caminho: string): Promise<Buffer | null> {
  if (usaSupabase()) {
    const { data, error } = await supabase().storage.from(BUCKET).download(caminho);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  try { return fs.readFileSync(localSeguro(caminho)); } catch { return null; }
}

export async function removerArquivo(caminho: string) {
  if (usaSupabase()) { await supabase().storage.from(BUCKET).remove([caminho]); return; }
  try { fs.unlinkSync(localSeguro(caminho)); } catch { /* já não existe */ }
}
