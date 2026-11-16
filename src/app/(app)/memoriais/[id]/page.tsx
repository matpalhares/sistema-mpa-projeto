import { notFound } from "next/navigation";
import { EditorMemorial } from "@/componentes/EditorMemorial";
import { Voltar } from "@/componentes/ui";
import { obter } from "@/lib/banco";
import { iaDisponivel } from "@/lib/ia";
import { contexto } from "@/lib/sessao";
import type { Memorial, Projeto } from "@/lib/tipos";

export default async function PaginaMemorial({ params }: { params: Promise<{ id: string }> }) {
  const { empresa } = await contexto();
  const { id } = await params;
  const me = await obter<Memorial>("memoriais", id, empresa.id);
  if (!me) notFound();
  const p = await obter<Projeto>("projetos", me.projetoId, empresa.id);
  return (
    <div className="space-y-4">
      <Voltar href={`/projetos/${me.projetoId}?aba=memorial`} texto="Projeto" />
      <div>
        <p className="text-sm text-cinza">{p?.obra} · {empresa.sigla}</p>
        <h1 className="titulo text-2xl">Memorial descritivo R{String(me.revisao).padStart(2, "0")}</h1>
      </div>
      <EditorMemorial memorial={me} plantas={(p?.arquivos ?? []).filter((a) => a.categoria === "planta")} iaLigada={iaDisponivel()} marcaDefinida={empresa.marca.definida} sigla={empresa.sigla} />
    </div>
  );
}
