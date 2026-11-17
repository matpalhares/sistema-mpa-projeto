import { notFound } from "next/navigation";
import { EditorMarcenaria } from "@/componentes/EditorMarcenaria";
import { Voltar } from "@/componentes/ui";
import { obter } from "@/lib/banco";
import { contexto } from "@/lib/sessao";
import type { ConjuntoMarcenaria, Projeto } from "@/lib/tipos";

export default async function PaginaMarcenaria({ params }: { params: Promise<{ id: string }> }) {
  const { empresa } = await contexto();
  const { id } = await params;
  const cj = await obter<ConjuntoMarcenaria>("marcenarias", id, empresa.id);
  if (!cj) notFound();
  const p = await obter<Projeto>("projetos", cj.projetoId, empresa.id);
  const arquivos = p?.arquivos ?? [];
  return (
    <div className="space-y-4">
      <Voltar href={`/projetos/${cj.projetoId}?aba=detalhamentos`} texto="Projeto" />
      <div>
        <p className="text-sm text-cinza">{p?.obra} · {empresa.sigla}</p>
        <h1 className="titulo text-2xl">Marcenaria</h1>
        <p className="text-sm text-cinza">Pranchas de cada móvel, lista de peças, ferragens, plano de corte e planilha.</p>
      </div>
      <EditorMarcenaria cj={cj} projetoId={cj.projetoId} modelos={arquivos.filter((a) => /\.json$/i.test(a.nome))} plantas={arquivos.filter((a) => a.categoria === "planta")} marcaDefinida={empresa.marca.definida} sigla={empresa.sigla} />
    </div>
  );
}
