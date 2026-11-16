import { notFound } from "next/navigation";
import { EditorMolhadas } from "@/componentes/EditorMolhadas";
import { Voltar } from "@/componentes/ui";
import { obter } from "@/lib/banco";
import { iaDisponivel } from "@/lib/ia";
import { contexto } from "@/lib/sessao";
import type { ConjuntoMolhadas, Projeto } from "@/lib/tipos";

export default async function PaginaMolhadas({ params }: { params: Promise<{ id: string }> }) {
  const { empresa } = await contexto();
  const { id } = await params;
  const cj = await obter<ConjuntoMolhadas>("molhadas", id, empresa.id);
  if (!cj) notFound();
  const p = await obter<Projeto>("projetos", cj.projetoId, empresa.id);
  return (
    <div className="space-y-4">
      <Voltar href={`/projetos/${cj.projetoId}?aba=detalhamentos`} texto="Projeto" />
      <div>
        <p className="text-sm text-cinza">{p?.obra} · {empresa.sigla}</p>
        <h1 className="titulo text-2xl">Áreas molhadas a partir da planta</h1>
        <p className="text-sm text-cinza">Gera o executivo A3 de cada banheiro e a prancha de marmoraria de cada bancada.</p>
      </div>
      <EditorMolhadas cj={cj} plantas={(p?.arquivos ?? []).filter((a) => a.categoria === "planta")} iaLigada={iaDisponivel()} marcaDefinida={empresa.marca.definida} sigla={empresa.sigla} />
    </div>
  );
}
