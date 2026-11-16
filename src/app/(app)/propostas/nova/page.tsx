import Link from "next/link";
import { novaProposta } from "../../../acoes";
import { Voltar } from "@/componentes/ui";
import { listar } from "@/lib/banco";
import { contexto } from "@/lib/sessao";
import type { Cliente, Projeto } from "@/lib/tipos";

export default async function NovaProposta() {
  const { empresa, empresas } = await contexto();
  const [projetos, clientes] = await Promise.all([listar<Projeto>("projetos", empresa.id), listar<Cliente>("clientes", empresa.id)]);
  const ativos = projetos.filter((p) => !p.arquivado);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Voltar href="/" texto="Painel" />
      <h1 className="titulo text-2xl">Gerar proposta</h1>
      <section className="cartao">
        <h2 className="titulo mb-1 text-sm">Proposta para um projeto já cadastrado ({empresa.sigla})</h2>
        <p className="mb-3 text-xs text-cinza">Cliente, obra e local já vêm preenchidos.</p>
        {ativos.length === 0 ? <p className="text-sm text-cinza">Nenhum projeto ativo nesta empresa. <Link href="/projetos/novo" className="font-semibold text-azul underline">Criar projeto</Link></p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {ativos.map((p) => (
              <form key={p.id} action={novaProposta}><input type="hidden" name="projetoId" value={p.id} />
                <button className="opcao w-full"><span className="block text-xs opacity-70">{clientes.find((c) => c.id === p.clienteId)?.nome}</span><strong>{p.obra}</strong></button>
              </form>
            ))}
          </div>
        )}
      </section>
      <section className="cartao">
        <h2 className="titulo mb-1 text-sm">Proposta avulsa (cliente ainda sem projeto): qual empresa?</h2>
        <p className="mb-3 text-xs text-cinza">O documento sai com a identidade da empresa escolhida.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {empresas.map((e) => (
            <form key={e.id} action={novaProposta}><input type="hidden" name="empresaId" value={e.id} />
              <button className="opcao w-full"><strong>{e.sigla}</strong> · {e.nome}{!e.marca.definida && <span className="adefinir ml-2">marca a definir</span>}</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
