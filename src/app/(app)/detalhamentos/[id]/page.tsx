import { notFound } from "next/navigation";
import { EditorBancada } from "@/componentes/EditorBancada";
import { Voltar } from "@/componentes/ui";
import { obter } from "@/lib/banco";
import { contexto } from "@/lib/sessao";
import type { Detalhamento, Projeto } from "@/lib/tipos";

export default async function PaginaDetalhamento({ params }: { params: Promise<{ id: string }> }) {
  const { empresa } = await contexto();
  const { id } = await params;
  const det = await obter<Detalhamento>("detalhamentos", id, empresa.id);
  if (!det) notFound();
  const p = await obter<Projeto>("projetos", det.projetoId, empresa.id);
  const plantas = (p?.arquivos ?? []).filter((a) => a.categoria === "planta");
  return (
    <div className="space-y-4">
      <Voltar href={`/projetos/${det.projetoId}?aba=detalhamentos`} texto="Projeto" />
      <div>
        <p className="text-sm text-cinza">{p?.obra} · {empresa.sigla}</p>
        <h1 className="titulo text-2xl">Marmoraria: bancada</h1>
      </div>
      <EditorBancada det={det} plantas={plantas} marcaDefinida={empresa.marca.definida} sigla={empresa.sigla} />
    </div>
  );
}
