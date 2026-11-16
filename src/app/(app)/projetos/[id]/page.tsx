import Link from "next/link";
import { notFound } from "next/navigation";
import { arquivarProjeto, atualizarProjeto, definirEtapa, excluirArquivo, novaProposta, novoConjuntoMolhadas, novoDetalhamento, novoMemorial, statusProposta } from "../../../acoes";
import { BarraEtapas } from "@/componentes/BarraEtapas";
import { CamposProjeto } from "@/componentes/CamposProjeto";
import { EnvioArquivo } from "@/componentes/EnvioArquivo";
import { FormAcao } from "@/componentes/FormAcao";
import { EmBreve, Voltar, tamanho } from "@/componentes/ui";
import { listar, obter } from "@/lib/banco";
import { dataBR, moeda } from "@/lib/formato";
import { pendenciasProjeto } from "@/lib/pendencias";
import { contexto } from "@/lib/sessao";
import type { Cliente, ConjuntoMolhadas, Detalhamento, Memorial, Projeto, Proposta } from "@/lib/tipos";

const CATEGORIA = { planta: "Planta baixa", sketchup: "SketchUp", contrato: "Contrato", outro: "Outro" };
const COR_STATUS: Record<string, string> = { rascunho: "bg-bege text-cinza", enviada: "bg-[#DDEBF7] text-azul", aprovada: "bg-verde/15 text-verde", recusada: "bg-vermelho/10 text-vermelho" };

export default async function PaginaProjeto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { empresa } = await contexto();
  const { id } = await params;
  const { aba = "visao" } = await searchParams;
  const p = await obter<Projeto>("projetos", id, empresa.id);
  if (!p) notFound();
  const [c, propostas, memoriais, detalhamentos, conjuntos] = await Promise.all([
    obter<Cliente>("clientes", p.clienteId, empresa.id),
    listar<Proposta>("propostas", empresa.id).then((l) => l.filter((x) => x.projetoId === p.id)),
    listar<Memorial>("memoriais", empresa.id).then((l) => l.filter((x) => x.projetoId === p.id)),
    listar<Detalhamento>("detalhamentos", empresa.id).then((l) => l.filter((x) => x.projetoId === p.id)),
    listar<ConjuntoMolhadas>("molhadas", empresa.id).then((l) => l.filter((x) => x.projetoId === p.id)),
  ]);
  const pend = pendenciasProjeto(p, c);
  // Regra T10: Orçamento de obra e Cronograma só existem se o cliente contratou a execução.
  const abas = [
    ["visao", "Visão geral"], ["dados", "Dados"], ["propostas", `Propostas (${propostas.length})`], ["memorial", `Memorial (${memoriais.length})`], ["detalhamentos", `Detalhamentos (${detalhamentos.length + conjuntos.length})`], ["arquivos", `Arquivos (${p.arquivos.length})`],
    ...(p.contratouExecucao === true ? [["orcamento", "Orçamento de obra"], ["cronograma", "Cronograma"]] : []),
  ];
  return (
    <div className="space-y-5">
      <Voltar href="/" texto="Painel" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-cinza">{c?.nome} · {empresa.sigla}{p.arquivado ? " · arquivado" : ""}</p>
          <h1 className="titulo text-2xl">{p.obra}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={novaProposta}><input type="hidden" name="projetoId" value={p.id} /><button className="botao-ouro">Gerar proposta</button></form>
          <form action={novoMemorial}><input type="hidden" name="projetoId" value={p.id} /><button className="botao">Gerar memorial</button></form>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-begelinha" aria-label="Abas do projeto">
        {abas.map(([k, r]) => (
          <Link key={k} href={`/projetos/${p.id}?aba=${k}`} className={"rounded-t-xl px-4 py-2 text-sm font-semibold " + (aba === k ? "bg-azul text-white" : "text-azul hover:bg-bege")}>{r}</Link>
        ))}
      </nav>

      {aba === "visao" && (
        <div className="space-y-5">
          <section className="cartao">
            <h2 className="titulo mb-1 text-sm">Etapas do projeto</h2>
            <p className="mb-3 text-xs text-cinza">Clique na etapa em que o projeto está agora.</p>
            <BarraEtapas atual={p.etapaAtual} id={p.id} acao={definirEtapa} />
          </section>
          <div className="grid gap-5 md:grid-cols-2">
            <section className="cartao">
              <h2 className="titulo mb-3 text-sm">Falta preencher</h2>
              {pend.length === 0 ? <p className="text-sm text-verde">Cadastro completo.</p> : (
                <ul className="space-y-2 text-sm">{pend.map((x, i) => <li key={i}><Link href={x.link} className="block rounded-lg bg-adefinir/60 px-3 py-2 hover:bg-adefinir">{x.texto}</Link></li>)}</ul>
              )}
            </section>
            <section className="cartao space-y-3 text-sm">
              <h2 className="titulo text-sm">O que vem nas próximas fases</h2>
              <p className="flex items-center justify-between">Marcenaria a partir do SketchUp <EmBreve fase={2} /></p>
              <p className="flex items-center justify-between">Cronograma, relatório, comparativo, financeiro e recibos <EmBreve fase={3} /></p>
              {p.contratouExecucao !== true && <p className="rounded-lg bg-bege/60 p-2 text-xs text-cinza">As abas Orçamento de obra e Cronograma estão ocultas porque {p.contratouExecucao === false ? "o cliente não contratou a execução" : "ainda não foi informado se o cliente contratou a execução"}.</p>}
            </section>
          </div>
          <form action={arquivarProjeto}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="arquivar" value={p.arquivado ? "0" : "1"} /><button className="text-sm text-cinza underline">{p.arquivado ? "Reativar projeto" : "Arquivar projeto"}</button></form>
        </div>
      )}

      {aba === "dados" && (
        <FormAcao acao={atualizarProjeto} botao="Salvar dados" className="cartao">
          <input type="hidden" name="id" value={p.id} />
          <CamposProjeto p={p} c={c} />
        </FormAcao>
      )}

      {aba === "propostas" && (
        <section className="space-y-3">
          {propostas.length === 0 && <div className="cartao text-sm text-cinza">Nenhuma proposta ainda. Use o botão <strong>Gerar proposta</strong> acima.</div>}
          {propostas.map((pr) => (
            <div key={pr.id} className="cartao flex flex-wrap items-center gap-3">
              <div className="grow">
                <p className="font-semibold text-azul">Proposta v{pr.versao} · {pr.dados.objetivo || <span className="adefinir">objetivo a definir</span>}</p>
                <p className="text-xs text-cinza">{dataBR(pr.dados.data)} · {pr.dados.valorTotal != null ? moeda(pr.dados.valorTotal) : <span className="adefinir">valor a definir</span>}</p>
              </div>
              <form action={statusProposta} className="flex items-center gap-1">
                <input type="hidden" name="id" value={pr.id} />
                {(["rascunho", "enviada", "aprovada", "recusada"] as const).map((s) => (
                  <button key={s} name="status" value={s} className={"etiqueta " + (pr.status === s ? COR_STATUS[s] + " ring-2 ring-azul/40" : "bg-white text-cinza hover:bg-bege")}>{s}</button>
                ))}
              </form>
              {pr.pdf && <a className="botao-leve" href={`/api/arquivo?c=${encodeURIComponent(pr.pdf)}&ver=1`} target="_blank">PDF</a>}
              {pr.docx && <a className="botao-leve" href={`/api/arquivo?c=${encodeURIComponent(pr.docx)}`}>DOCX</a>}
              <Link href={`/propostas/${pr.id}`} className="botao">Abrir</Link>
            </div>
          ))}
        </section>
      )}

      {aba === "memorial" && (
        <section className="space-y-3">
          {memoriais.length === 0 && <div className="cartao text-sm text-cinza">Nenhum memorial ainda. Use o botão <strong>Gerar memorial</strong> acima. Se tiver a planta, envie antes na aba Arquivos.</div>}
          {memoriais.map((m) => (
            <div key={m.id} className="cartao flex flex-wrap items-center gap-3">
              <div className="grow"><p className="font-semibold text-azul">Memorial R{String(m.revisao).padStart(2, "0")}</p><p className="text-xs text-cinza">Atualizado em {dataBR(m.atualizadoEm)}</p></div>
              {(["completo", "simplificado"] as const).map((t) => m.saidas[t] && (
                <span key={t} className="flex items-center gap-1 text-xs text-cinza">{t === "completo" ? "Completo" : "Prefeitura"}:
                  {m.saidas[t]!.pdf && <a className="botao-leve" href={`/api/arquivo?c=${encodeURIComponent(m.saidas[t]!.pdf!)}&ver=1`} target="_blank">PDF</a>}
                  <a className="botao-leve" href={`/api/arquivo?c=${encodeURIComponent(m.saidas[t]!.docx)}`}>DOCX</a>
                </span>
              ))}
              <Link href={`/memoriais/${m.id}`} className="botao">Abrir</Link>
            </div>
          ))}
        </section>
      )}

      {aba === "detalhamentos" && (
        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <form action={novoDetalhamento} className="cartao"><input type="hidden" name="projetoId" value={p.id} />
              <p className="font-semibold text-azul">Marmoraria: bancada</p>
              <p className="mb-3 text-xs text-cinza">Uma bancada avulsa (cozinha, copa), com as medidas informadas por você.</p>
              <button className="botao w-full">Detalhar bancada</button>
            </form>
            <form action={novoConjuntoMolhadas} className="cartao border-azul"><input type="hidden" name="projetoId" value={p.id} />
              <p className="font-semibold text-azul">Áreas molhadas a partir da planta</p>
              <p className="mb-3 text-xs text-cinza">O sistema lê os banheiros da planta, você confere o desenho e responde as perguntas. Saem o executivo A3 de cada ambiente e a marmoraria de cada bancada.</p>
              <button className="botao-ouro w-full">Detalhar pela planta</button>
            </form>
            <div className="cartao bg-bege/40"><p className="flex items-center justify-between font-semibold text-azul">Marcenaria <EmBreve fase={2} /></p><p className="text-xs text-cinza">A partir do SketchUp, com o plugin exportador. Em construção.</p></div>
          </div>
          {conjuntos.map((cj) => (
            <div key={cj.id} className="cartao flex flex-wrap items-center gap-3">
              <div className="grow"><p className="font-semibold text-azul">Áreas molhadas · {cj.ambientes.map((a) => a.nome).join(", ") || "sem ambientes ainda"}</p><p className="text-xs text-cinza">{cj.saidas.length} prancha(s) gerada(s) · atualizado em {dataBR(cj.atualizadoEm)}</p></div>
              <Link href={`/areas-molhadas/${cj.id}`} className="botao">Abrir</Link>
            </div>
          ))}
          {detalhamentos.map((dt) => (
            <div key={dt.id} className="cartao flex flex-wrap items-center gap-3">
              <div className="grow"><p className="font-semibold text-azul">Marmoraria · {dt.dados.nomePrancha || dt.dados.ambiente || "bancada sem nome"}</p><p className="text-xs text-cinza">{dt.dados.pedra || "pedra a responder"} · atualizado em {dataBR(dt.atualizadoEm)}</p></div>
              {dt.pdf && <a className="botao-leve" href={`/api/arquivo?c=${encodeURIComponent(dt.pdf)}&ver=1`} target="_blank">PDF</a>}
              <Link href={`/detalhamentos/${dt.id}`} className="botao">Abrir</Link>
            </div>
          ))}
        </section>
      )}

      {aba === "arquivos" && (
        <section className="space-y-4">
          <div className="cartao"><h2 className="titulo mb-3 text-sm">Enviar arquivo</h2><EnvioArquivo projetoId={p.id} /></div>
          {p.arquivos.length === 0 ? <p className="text-sm text-cinza">Nenhum arquivo enviado.</p> : (
            <ul className="space-y-2">
              {p.arquivos.map((a) => (
                <li key={a.caminho} className="cartao flex flex-wrap items-center gap-3 py-3">
                  <div className="grow"><p className="text-sm font-semibold text-azul">{a.nome}</p><p className="text-xs text-cinza">{CATEGORIA[a.categoria]} · {tamanho(a.tamanho)} · {dataBR(a.enviadoEm)}</p></div>
                  <a className="botao-leve" href={`/api/arquivo?c=${encodeURIComponent(a.caminho)}&ver=1`} target="_blank">Abrir</a>
                  <form action={excluirArquivo}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="caminho" value={a.caminho} /><button className="text-sm text-vermelho underline">Excluir</button></form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(aba === "orcamento" || aba === "cronograma") && p.contratouExecucao === true && (
        <div className="cartao text-sm text-cinza"><p className="mb-2 flex items-center gap-2 font-semibold text-azul">{aba === "orcamento" ? "Orçamento de obra" : "Cronograma"} <EmBreve fase={3} /></p>
          {aba === "orcamento" ? "O orçamento de obra é feito no Sistema MPA Obra e chega aqui pelo arquivo pacote_obra.json." : "O cronograma (Gantt e tabela em dias úteis) entra na Fase 3."}</div>
      )}
    </div>
  );
}
