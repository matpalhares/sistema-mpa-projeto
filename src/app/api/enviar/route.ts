// Upload de arquivos do projeto (planta, SketchUp, contrato). Vai direto ao servidor, sem passar pelo chat.
import { NextResponse } from "next/server";
import { obter, salvar } from "@/lib/banco";
import { nomeSeguro, salvarArquivo } from "@/lib/arquivos";
import { contexto } from "@/lib/sessao";
import type { ArquivoRef, Projeto } from "@/lib/tipos";

export async function POST(req: Request) {
  const { empresa } = await contexto();
  const f = await req.formData();
  const p = await obter<Projeto>("projetos", String(f.get("projetoId") ?? ""), empresa.id);
  const arq = f.get("arquivo");
  if (!p || !(arq instanceof File) || arq.size === 0) return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });
  const cat = String(f.get("categoria") ?? "outro");
  const categoria = (["planta", "sketchup", "contrato", "outro"].includes(cat) ? cat : "outro") as ArquivoRef["categoria"];
  const caminho = `${empresa.id}/projetos/${p.id}/${Date.now()}_${nomeSeguro(arq.name)}`;
  await salvarArquivo(caminho, Buffer.from(await arq.arrayBuffer()), arq.type || undefined);
  const ref: ArquivoRef = { nome: arq.name, caminho, tamanho: arq.size, enviadoEm: new Date().toISOString(), categoria };
  await salvar<Projeto>("projetos", { ...p, arquivos: [...p.arquivos, ref] });
  return NextResponse.json({ ok: true, arquivo: ref });
}
