import { notFound } from "next/navigation";
import { EditorProposta } from "@/componentes/EditorProposta";
import { Voltar } from "@/componentes/ui";
import { obter } from "@/lib/banco";
import { contexto } from "@/lib/sessao";
import type { Proposta } from "@/lib/tipos";

export default async function PaginaProposta({ params }: { params: Promise<{ id: string }> }) {
  const { empresa } = await contexto();
  const { id } = await params;
  const pr = await obter<Proposta>("propostas", id, empresa.id);
  if (!pr) notFound();
  return (
    <div className="space-y-4">
      <Voltar href={pr.projetoId ? `/projetos/${pr.projetoId}?aba=propostas` : "/"} texto={pr.projetoId ? "Projeto" : "Painel"} />
      <div>
        <p className="text-sm text-cinza">Empresa da proposta: <strong className="text-azul">{empresa.nome}</strong> (troque no topo da tela antes de criar, se for outra)</p>
        <h1 className="titulo text-2xl">Proposta v{pr.versao}</h1>
      </div>
      <EditorProposta proposta={pr} marcaDefinida={empresa.marca.definida} sigla={empresa.sigla} />
    </div>
  );
}
