"use client";
import { useState, useTransition } from "react";
import { salvarEGerarProposta, salvarProposta } from "@/app/acoes";
import { calcularPagamento, errosProposta, pendenciasProposta } from "@/lib/documentos/regras-proposta";
import { TIPOS_CONTRATACAO, textosDoPerfil } from "@/lib/documentos/textos-proposta";
import { dataBR, moeda, somarDias, temTravessao } from "@/lib/formato";
import type { DadosProposta, PerfilProposta, Proposta, Verificacao } from "@/lib/tipos";
import { Calculo } from "./ui";

const paraNumero = (v: string): number | null => { if (!v.trim()) return null; const n = Number(v.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const deNumero = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

function Lista({ itens, aoMudar, dica, rotuloAdd }: { itens: string[]; aoMudar: (l: string[]) => void; dica: string; rotuloAdd: string }) {
  return (
    <div className="space-y-2">
      {itens.map((it, i) => (
        <div key={i} className="flex gap-2">
          <input className="campo" value={it} placeholder={dica} onChange={(e) => aoMudar(itens.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`Item ${i + 1}`} />
          <button type="button" className="botao-leve" onClick={() => aoMudar(itens.filter((_, k) => k !== i))} aria-label="Remover item">✕</button>
        </div>
      ))}
      <button type="button" className="botao-leve" onClick={() => aoMudar([...itens, ""])}>+ {rotuloAdd}</button>
    </div>
  );
}

export function EditorProposta({ proposta, marcaDefinida, sigla }: { proposta: Proposta; marcaDefinida: boolean; sigla: string }) {
  const [d, setD] = useState<DadosProposta>(proposta.dados);
  const [valorTxt, setValorTxt] = useState(deNumero(proposta.dados.valorTotal));
  const [saida, setSaida] = useState<{ docx: string | null; pdf: string | null; verificacao: Verificacao | null }>({ docx: proposta.docx, pdf: proposta.pdf, verificacao: proposta.verificacao });
  const [erros, setErros] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [sujo, setSujo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const mudar = (patch: Partial<DadosProposta>) => { setD((x) => ({ ...x, ...patch })); setSujo(true); setMsg(""); };
  const falta = pendenciasProposta(d);
  const bloqueios = [...errosProposta(d), ...(marcaDefinida ? [] : [`A marca da ${sigla} está a definir. Cadastre em Empresas e marcas para gerar o documento.`])];
  const calc = calcularPagamento(d);
  const travessao = [d.carta, d.missao, d.observacoes, ...d.termos, ...d.escopo.flatMap((e) => [e.titulo, e.descricao]), ...d.diferenciais.flatMap((e) => [e.titulo, e.texto])].some(temTravessao);
  const [textosMexidos, setTextosMexidos] = useState(false);
  const escolherPerfil = (perfil: PerfilProposta) => {
    if (perfil === d.perfil) return;
    if (textosMexidos && !window.confirm("Trocar o perfil substitui a carta, os diferenciais, a missão e os próximos passos pelos textos de partida desse perfil. Continuar?")) return;
    mudar({ perfil, ...textosDoPerfil(perfil) }); setTextosMexidos(false);
  };
  const mudarTexto = (patch: Partial<DadosProposta>) => { setTextosMexidos(true); mudar(patch); };
  const nEtapas = d.etapas.filter((e) => e.titulo.trim()).length;

  const salvar = () => iniciar(async () => { const r = await salvarProposta(proposta.id, d); if (r.ok) { setSujo(false); setMsg("Rascunho salvo."); setErros([]); } else setErros(r.erros); });
  const gerar = () => iniciar(async () => {
    setMsg(""); setErros([]);
    const r = await salvarEGerarProposta(proposta.id, d);
    if (!r.ok) { setErros(r.erros); return; }
    setSujo(false); setSaida({ docx: r.dados!.docx, pdf: r.dados!.pdf, verificacao: r.dados!.verificacao }); setMsg("Proposta gerada.");
  });
  const vazio = (v: string | number | null) => (v == null || v === "" ? " campo-vazio" : "");
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">1. Cliente e objetivo</h2>
          <div><span className="rotulo">Para quem é a proposta? {!d.perfil && <span className="adefinir ml-1 normal-case">a definir</span>}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {([["comercial", "Comércio ou empresa", "Textos falam do negócio, do fluxo e da marca."], ["residencial", "Residência ou família", "Textos falam da rotina, do lar e do imóvel."]] as const).map(([v, t, sub]) => (
                <button type="button" key={v} className={"opcao " + (d.perfil === v ? "opcao-ativa" : "")} onClick={() => escolherPerfil(v)}><strong className="block">{t}</strong><span className="text-xs opacity-80">{sub}</span></button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="rotulo">Nome do cliente</span><input className={"campo" + vazio(d.clienteNome)} value={d.clienteNome} onChange={(e) => mudar({ clienteNome: e.target.value })} /></label>
            <label className="block"><span className="rotulo">Projeto (aparece na capa)</span><input className={"campo" + vazio(d.objetivo)} value={d.objetivo} placeholder="Ex.: Projeto para ampliação e estruturação comercial" onChange={(e) => mudar({ objetivo: e.target.value })} /></label>
          </div>
          <div><span className="rotulo">Tipo de contratação</span>
            <div className="flex flex-wrap gap-2">
              {TIPOS_CONTRATACAO.map((t) => t === "Outro" ? null : <button type="button" key={t} className={"opcao " + (d.tipoContratacao === t ? "opcao-ativa" : "")} onClick={() => mudar({ tipoContratacao: t, objetivo: d.objetivo || t })}>{t}</button>)}
              <input className={"campo w-56" + vazio(d.tipoContratacao)} placeholder="Outro: escreva aqui" value={TIPOS_CONTRATACAO.includes(d.tipoContratacao) ? "" : d.tipoContratacao} onChange={(e) => mudar({ tipoContratacao: e.target.value })} aria-label="Outro tipo de contratação" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="rotulo">Obra</span><input className="campo" value={d.obra} onChange={(e) => mudar({ obra: e.target.value })} /></label>
            <label className="block"><span className="rotulo">Local</span><input className="campo" value={d.local} onChange={(e) => mudar({ local: e.target.value })} /></label>
            <label className="block"><span className="rotulo">Data da proposta</span><input type="date" className="campo" value={d.data} onChange={(e) => mudar({ data: e.target.value })} /></label>
            <div><span className="rotulo">Validade</span>
              <div className="flex flex-wrap items-center gap-2">
                {[7, 15, 30].map((n) => <button type="button" key={n} className={"opcao " + (d.validadeDias === n ? "opcao-ativa" : "")} onClick={() => mudar({ validadeDias: n })}>{n} dias</button>)}
                <input className={"campo w-24" + vazio(d.validadeDias)} inputMode="numeric" placeholder="dias" value={d.validadeDias ?? ""} onChange={(e) => mudar({ validadeDias: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : null })} aria-label="Validade em dias" />
              </div>
              {d.validadeDias != null && d.data && <Calculo>Válida até {dataBR(somarDias(d.data, d.validadeDias))}: data da proposta ({dataBR(d.data)}) + {d.validadeDias} dias corridos.</Calculo>}
            </div>
          </div>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">2. Apresentação (carta em 1ª pessoa)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="rotulo">Título da apresentação</span><input className="campo" value={d.tituloApresentacao} onChange={(e) => mudarTexto({ tituloApresentacao: e.target.value })} /></label>
            <label className="block"><span className="rotulo">Saudação</span><input className="campo" value={d.saudacao} placeholder={d.clienteNome ? `Olá, ${d.clienteNome}.` : "Ex.: Olá, equipe da Cris Bebidas."} onChange={(e) => mudar({ saudacao: e.target.value })} /></label>
          </div>
          <textarea className="campo min-h-48" value={d.carta} onChange={(e) => mudarTexto({ carta: e.target.value })} aria-label="Carta ao cliente" />
          <label className="block"><span className="rotulo">Frase da capa</span><input className="campo" value={d.fraseCapa} onChange={(e) => mudarTexto({ fraseCapa: e.target.value })} /></label>
          {travessao && <p className="rounded-lg bg-adefinir p-2 text-xs text-adefinir-texto">Há travessão longo no texto. Ao gerar, ele é trocado por vírgula automaticamente (regra da marca).</p>}
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">3. Por que investir em um bom projeto (sem citar preço)</h2>
          {d.diferenciais.map((x, i) => (
            <div key={i} className="grid gap-2 rounded-xl border-l-4 border-dourado bg-bege/40 p-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <input className="campo font-semibold" value={x.titulo} placeholder="Título" aria-label={`Diferencial ${i + 1}: título`} onChange={(e) => mudarTexto({ diferenciais: d.diferenciais.map((y, k) => (k === i ? { ...y, titulo: e.target.value } : y)) })} />
                <input className="campo" value={x.texto} placeholder="Explicação em uma frase" aria-label={`Diferencial ${i + 1}: texto`} onChange={(e) => mudarTexto({ diferenciais: d.diferenciais.map((y, k) => (k === i ? { ...y, texto: e.target.value } : y)) })} />
              </div>
              <button type="button" className="botao-leve h-fit" onClick={() => mudarTexto({ diferenciais: d.diferenciais.filter((_, k) => k !== i) })} aria-label="Remover diferencial">✕</button>
            </div>
          ))}
          <button type="button" className="botao-leve" disabled={d.diferenciais.length >= 5} onClick={() => mudarTexto({ diferenciais: [...d.diferenciais, { titulo: "", texto: "" }] })}>+ Adicionar diferencial</button>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">4. Escopo: o que está incluído no projeto</h2>
          <p className="text-xs text-cinza">Cada item vira um card numerado: um título curto e uma frase explicando o benefício. Até 10 itens.</p>
          {d.escopo.map((x, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-bege/40 p-3 sm:grid-cols-[2rem_1fr_auto]">
              <span className="pt-2 text-lg font-bold text-dourado-escuro">{String(i + 1).padStart(2, "0")}</span>
              <div className="space-y-2">
                <input className="campo font-semibold" value={x.titulo} placeholder="Ex.: Maquete 3D digital da fachada" aria-label={`Escopo ${i + 1}: título`} onChange={(e) => mudar({ escopo: d.escopo.map((y, k) => (k === i ? { ...y, titulo: e.target.value } : y)) })} />
                <input className="campo" value={x.descricao} placeholder="Ex.: Permite enxergar a nova imagem antes mesmo de construir." aria-label={`Escopo ${i + 1}: descrição`} onChange={(e) => mudar({ escopo: d.escopo.map((y, k) => (k === i ? { ...y, descricao: e.target.value } : y)) })} />
              </div>
              <button type="button" className="botao-leve h-fit" onClick={() => mudar({ escopo: d.escopo.filter((_, k) => k !== i) })} aria-label="Remover item do escopo">✕</button>
            </div>
          ))}
          <button type="button" className="botao-leve" disabled={d.escopo.length >= 10} onClick={() => mudar({ escopo: [...d.escopo, { titulo: "", descricao: "" }] })}>+ Adicionar item do escopo</button>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">5. Etapas do projeto (de 4 a 6) <span className={"etiqueta ml-2 normal-case " + (nEtapas >= 4 && nEtapas <= 6 ? "bg-verde/15 text-verde" : "bg-vermelho/10 text-vermelho")}>{nEtapas} etapa(s)</span></h2>
          {d.etapas.map((e, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-bege/40 p-3 sm:grid-cols-[2rem_1fr_auto]">
              <span className="pt-2 text-lg font-bold text-dourado-escuro">{String(i + 1).padStart(2, "0")}</span>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input className="campo font-semibold" value={e.titulo} placeholder="Título da etapa" aria-label={`Título da etapa ${i + 1}`} onChange={(ev) => mudar({ etapas: d.etapas.map((x, k) => (k === i ? { ...x, titulo: ev.target.value } : x)) })} />
                  <input className="campo w-40" value={e.prazo} placeholder="Prazo (opcional)" aria-label={`Prazo da etapa ${i + 1}`} onChange={(ev) => mudar({ etapas: d.etapas.map((x, k) => (k === i ? { ...x, prazo: ev.target.value } : x)) })} />
                </div>
                <textarea className={"campo" + vazio(e.itens.join(""))} rows={Math.max(2, e.itens.length)} value={e.itens.join("\n")} placeholder="O que acontece nesta etapa, um item por linha" aria-label={`Itens da etapa ${i + 1}`} onChange={(ev) => mudar({ etapas: d.etapas.map((x, k) => (k === i ? { ...x, itens: ev.target.value.split("\n") } : x)) })} />
              </div>
              <button type="button" className="botao-leve h-fit" disabled={d.etapas.length <= 4} onClick={() => mudar({ etapas: d.etapas.filter((_, k) => k !== i) })} aria-label="Remover etapa">✕</button>
            </div>
          ))}
          <button type="button" className="botao-leve" disabled={d.etapas.length >= 6} onClick={() => mudar({ etapas: [...d.etapas, { titulo: "", itens: [], prazo: "" }] })}>+ Adicionar etapa</button>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">6. Investimento</h2>
          <div className="grid gap-3 sm:grid-cols-5">
            <label className="block sm:col-span-2"><span className="rotulo">Valor total (R$)</span>
              <input className={"campo text-lg font-semibold" + vazio(d.valorTotal)} inputMode="decimal" placeholder="a definir" value={valorTxt} onChange={(e) => { setValorTxt(e.target.value); mudar({ valorTotal: paraNumero(e.target.value) }); }} />
              {valorTxt.trim() !== "" && d.valorTotal == null && <span className="text-xs text-vermelho">Digite só números, ex.: 12.500,00</span>}
            </label>
            <label className="block"><span className="rotulo">Desconto à vista (%)</span><input className="campo" inputMode="decimal" value={deNumero(d.descontoAVista)} onChange={(e) => mudar({ descontoAVista: Math.min(100, Math.max(0, paraNumero(e.target.value) ?? 0)) })} /></label>
            <label className="block"><span className="rotulo">Parcelas sem juros</span><input className="campo" inputMode="numeric" value={d.parcelasSemJuros} onChange={(e) => mudar({ parcelasSemJuros: Math.max(1, parseInt(e.target.value) || 1) })} /></label>
            <label className="block"><span className="rotulo">Parcelas com juros</span><input className="campo" inputMode="numeric" value={d.parcelasComJuros} onChange={(e) => mudar({ parcelasComJuros: Math.max(1, parseInt(e.target.value) || 1) })} /></label>
          </div>
          <div className="rounded-xl bg-azul p-4 text-sm text-white">
            <p className="text-2xl font-bold">{d.valorTotal != null ? moeda(d.valorTotal) : <span className="adefinir">valor a definir</span>}</p>
            <p>À vista: {calc.aVista != null ? moeda(calc.aVista) : ""} ({deNumero(d.descontoAVista)}% de desconto)</p>
            <p>Parcelado: até {d.parcelasSemJuros}x {calc.parcelaSemJuros != null ? "de " + moeda(calc.parcelaSemJuros) : ""} sem juros</p>
            <p>Cartão: até {d.parcelasComJuros}x com juros da operadora</p>
          </div>
          {d.valorTotal != null && (
            <Calculo>
              À vista = {moeda(d.valorTotal)} × (100% − {deNumero(d.descontoAVista)}%) = {moeda(calc.aVista!)}.<br />
              Parcela sem juros = {moeda(d.valorTotal)} ÷ {d.parcelasSemJuros} = {moeda(calc.parcelaSemJuros!)} (arredondada para centavos).<br />
              Os juros do cartão são da operadora e não são calculados aqui.
            </Calculo>
          )}
          <div><span className="rotulo">Itens extras (fora do valor acima)</span>
            <div className="space-y-2">
              {d.itensExtras.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input className="campo" value={it.descricao} placeholder="Descrição" aria-label={`Item extra ${i + 1}`} onChange={(e) => mudar({ itensExtras: d.itensExtras.map((x, k) => (k === i ? { ...x, descricao: e.target.value } : x)) })} />
                  <input className={"campo w-36" + vazio(it.valor)} inputMode="decimal" placeholder="R$ a definir" defaultValue={deNumero(it.valor)} aria-label={`Valor do item extra ${i + 1}`} onChange={(e) => mudar({ itensExtras: d.itensExtras.map((x, k) => (k === i ? { ...x, valor: paraNumero(e.target.value) } : x)) })} />
                  <button type="button" className="botao-leve" onClick={() => mudar({ itensExtras: d.itensExtras.filter((_, k) => k !== i) })} aria-label="Remover item extra">✕</button>
                </div>
              ))}
              <button type="button" className="botao-leve" onClick={() => mudar({ itensExtras: [...d.itensExtras, { descricao: "", valor: null }] })}>+ Adicionar item extra</button>
            </div>
          </div>
          <label className="block"><span className="rotulo">Observações</span><textarea className="campo" value={d.observacoes} onChange={(e) => mudar({ observacoes: e.target.value })} /></label>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">7. Termos e condições</h2>
          <p className="text-xs text-cinza">O primeiro termo (validade em dias) é escrito sozinho a partir da validade informada. Revise os demais para que reflitam o seu contrato.</p>
          <Lista itens={d.termos} aoMudar={(termos) => mudar({ termos })} dica="Condição" rotuloAdd="Adicionar condição" />
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">8. Encerramento</h2>
          <label className="block"><span className="rotulo">Minha missão</span><textarea className="campo" value={d.missao} onChange={(e) => mudarTexto({ missao: e.target.value })} /></label>
          <span className="rotulo">Próximos passos</span>
          <Lista itens={d.proximosPassos} aoMudar={(proximosPassos) => mudarTexto({ proximosPassos })} dica="Passo" rotuloAdd="Adicionar passo" />
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="cartao space-y-3">
          <h2 className="titulo text-sm">Gerar</h2>
          <button className="botao-ouro w-full" onClick={gerar} disabled={pendente || bloqueios.length > 0}>{pendente ? "Gerando..." : "Gerar proposta (DOCX + PDF)"}</button>
          <button className="botao-leve w-full" onClick={salvar} disabled={pendente || !sujo}>Salvar rascunho</button>
          {bloqueios.map((b, i) => <p key={i} className="aviso">{b}</p>)}
          {erros.map((b, i) => <p key={"e" + i} className="aviso" role="alert">{b}</p>)}
          {msg && <p className="sucesso" role="status">{msg}</p>}
          {saida.docx && (
            <div className="space-y-2 border-t border-begelinha pt-3">
              {sujo && <p className="text-xs text-adefinir-texto">Você mudou o texto depois de gerar. Gere de novo para atualizar os arquivos.</p>}
              <div className="flex gap-2">
                {saida.pdf && <a className="botao grow" href={`/api/arquivo?c=${encodeURIComponent(saida.pdf)}&ver=1`} target="_blank">Abrir PDF</a>}
                <a className="botao-leve grow" href={`/api/arquivo?c=${encodeURIComponent(saida.docx)}`}>Baixar DOCX</a>
              </div>
              {saida.verificacao && (
                <ul className="text-xs text-cinza">
                  <li>{saida.verificacao.pdfGerado ? `✓ PDF com ${saida.verificacao.paginas} páginas` : "PDF não gerado"}</li>
                  {saida.verificacao.pdfGerado && <li>{saida.verificacao.paginasEmBranco.length ? "✕ Há página em branco" : "✓ Sem páginas em branco"}</li>}
                  {saida.verificacao.pdfGerado && <li>{saida.verificacao.temTravessao ? "✕ Há travessão longo" : "✓ Sem travessão longo"}</li>}
                  {saida.verificacao.avisos.map((a, i) => <li key={i} className="text-vermelho">{a}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="cartao">
          <h2 className="titulo mb-2 text-sm">Falta preencher</h2>
          {falta.length === 0 ? <p className="text-sm text-verde">Tudo preenchido.</p> : (
            <>
              <ul className="space-y-1 text-sm">{falta.map((x) => <li key={x} className="rounded-lg bg-adefinir/60 px-3 py-1.5">{x}</li>)}</ul>
              <p className="mt-2 text-xs text-cinza">Você pode gerar mesmo assim: o que falta sai como &quot;a definir&quot; em amarelo.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
