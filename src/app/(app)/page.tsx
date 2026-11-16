import Link from "next/link";
import { listar } from "@/lib/banco";
import { contexto } from "@/lib/sessao";
import type { Cliente, Memorial, Projeto, Proposta } from "@/lib/tipos";
import { pendenciasGerais } from "@/lib/pendencias";
import { BarraEtapas } from "@/componentes/BarraEtapas";
import { EmBreve } from "@/componentes/ui";

export default async function Painel({ searchParams }: { searchParams: Promise<{ q?: string; arquivados?: string }> }) {
  const { empresa, usuario } = await contexto();
  const { q = "", arquivados } = await searchParams;
  const [projetos, clientes, propostas, memoriais] = await Promise.all([
    listar<Projeto>("projetos", empresa.id), listar<Cliente>("clientes", empresa.id), listar<Proposta>("propostas", empresa.id), listar<Memorial>("memoriais", empresa.id),
  ]);
  const ativos = projetos.filter((p) => !p.arquivado);
  const pend = pendenciasGerais(empresa, projetos, clientes, propostas, memoriais);
  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "";
  const busca = q.trim().toLowerCase();
  const lista = (arquivados ? projetos.filter((p) => p.arquivado) : ativos).filter((p) => !busca || (p.obra + " " + nomeCliente(p.clienteId)).toLowerCase().includes(busca));
  const avulsas = propostas.filter((p) => !p.projetoId);
  const cartoes = [
    { n: ativos.length, rotulo: "Projetos ativos", cor: "text-azul" },
    { n: pend.length, rotulo: "Pendências (falta preencher)", cor: pend.length ? "text-adefinir-texto" : "text-verde" },
    { n: propostas.filter((p) => p.status === "enviada").length, rotulo: "Propostas aguardando resposta", cor: "text-azul" },
    { n: memoriais.length, rotulo: "Memoriais", cor: "text-azul" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-cinza">Olá, {usuario.nome.split(" ")[0]}. Empresa: <strong className="text-azul">{empresa.nome}</strong></p>
          <h1 className="titulo text-2xl">Painel</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/projetos/novo" className="botao">+ Novo projeto</Link>
          <Link href="/propostas/nova" className="botao-ouro">Gerar proposta</Link>
        </div>
      </div>

      {!empresa.marca.definida && (
        <p className="rounded-xl bg-adefinir p-3 text-sm text-adefinir-texto">A marca da {empresa.sigla} está <strong>a definir</strong>. Você pode cadastrar projetos, mas os documentos só saem depois de enviar logo, cores e contatos em <Link href="/empresas" className="font-semibold underline">Empresas e marcas</Link>.</p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="cartao"><p className={"text-3xl font-bold " + c.cor}>{c.n}</p><p className="text-xs font-semibold uppercase tracking-wide text-cinza">{c.rotulo}</p></div>
        ))}
        <div className="cartao col-span-2 flex items-center justify-between bg-bege/40"><p className="text-xs font-semibold uppercase tracking-wide text-cinza">Detalhamentos (marmoraria, áreas molhadas, marcenaria)</p><EmBreve fase={2} /></div>
        <div className="cartao col-span-2 flex items-center justify-between bg-bege/40"><p className="text-xs font-semibold uppercase tracking-wide text-cinza">Obras em andamento e contas da semana</p><EmBreve fase={3} /></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="titulo">{arquivados ? "Projetos arquivados" : "Projetos"}</h2>
            <form className="flex gap-2">
              {arquivados && <input type="hidden" name="arquivados" value="1" />}
              <input name="q" defaultValue={q} placeholder="Buscar por obra ou cliente" className="campo w-56" aria-label="Buscar projeto" />
              <button className="botao-leve">Buscar</button>
            </form>
          </div>
          {lista.length === 0 ? (
            <div className="cartao text-center text-sm text-cinza">
              {busca ? "Nenhum projeto encontrado com essa busca." : arquivados ? "Nenhum projeto arquivado." : <>Nenhum projeto ainda. Comece em <Link href="/projetos/novo" className="font-semibold text-azul underline">+ Novo projeto</Link>.</>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {lista.map((p) => (
                <Link key={p.id} href={`/projetos/${p.id}`} className="cartao block transition hover:border-azul">
                  <p className="text-xs text-cinza">{nomeCliente(p.clienteId)}</p>
                  <h3 className="mb-1 font-semibold text-azul">{p.obra}</h3>
                  <p className="mb-3 text-xs text-cinza">{p.tipo || <span className="adefinir">tipo a definir</span>} · {p.areaM2 != null ? p.areaM2.toLocaleString("pt-BR") + " m²" : <span className="adefinir">área a definir</span>}</p>
                  <BarraEtapas atual={p.etapaAtual} />
                </Link>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm">{arquivados ? <Link href="/" className="text-azul underline">Ver projetos ativos</Link> : <Link href="/?arquivados=1" className="text-cinza underline">Ver arquivados</Link>}</p>

          {avulsas.length > 0 && (
            <div className="mt-6">
              <h2 className="titulo mb-3">Propostas sem projeto</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {avulsas.map((p) => (
                  <Link key={p.id} href={`/propostas/${p.id}`} className="cartao block hover:border-azul">
                    <p className="font-semibold text-azul">{p.dados.clienteNome || "Cliente a definir"}</p>
                    <p className="text-xs text-cinza">{p.dados.objetivo || "objetivo a definir"} · {p.status}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside>
          <h2 className="titulo mb-3">Falta preencher</h2>
          <div className="cartao">
            {pend.length === 0 ? <p className="text-sm text-verde">Nada pendente.</p> : (
              <ul className="space-y-2 text-sm">
                {pend.slice(0, 14).map((x, i) => (
                  <li key={i}><Link href={x.link} className="block rounded-lg bg-adefinir/60 px-3 py-2 hover:bg-adefinir"><span className="block text-xs text-cinza">{x.onde}</span>{x.texto}</Link></li>
                ))}
                {pend.length > 14 && <li className="text-xs text-cinza">e mais {pend.length - 14}.</li>}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
