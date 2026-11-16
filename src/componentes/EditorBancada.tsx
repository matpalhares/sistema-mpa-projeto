"use client";
import { useState, useTransition } from "react";
import { salvarDetalhamento, salvarEGerarDetalhamento } from "@/app/acoes";
import { AMBIENTES, PADRAO, PEDRAS, TIPOS_CUBA, TIPOS_TORNEIRA, eixoCuba, errosBancada, grapaRecomendada, pecasBancada, perguntasEmAberto, temCuba, type DadosBancada } from "@/lib/pranchas/regras-bancada";
import type { ArquivoRef, Detalhamento, VerificacaoPrancha } from "@/lib/tipos";
import { Calculo } from "./ui";

const paraNumero = (v: string): number | null => { if (!v.trim()) return null; const n = Number(v.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const deNumero = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
const m2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m";

function Medida({ rotulo, valor, aoMudar, dica }: { rotulo: string; valor: number | null; aoMudar: (v: number | null) => void; dica?: string }) {
  const [t, setT] = useState(deNumero(valor));
  return (
    <label className="block"><span className="rotulo">{rotulo} (m)</span>
      <input className={"campo" + (valor == null ? " campo-vazio" : "")} inputMode="decimal" placeholder={dica ?? "ex.: 1,20"} value={t} onChange={(e) => { setT(e.target.value); aoMudar(paraNumero(e.target.value)); }} />
    </label>
  );
}
function Opcoes({ pergunta, opcoes, valor, aoEscolher, outro, recomendado }: { pergunta: string; opcoes: readonly string[]; valor: string; aoEscolher: (v: string) => void; outro?: boolean; recomendado?: string }) {
  const livre = valor !== "" && !opcoes.includes(valor);
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{pergunta} {!valor && <span className="ml-1 inline-flex rounded-full bg-vermelho/10 px-2 py-0.5 text-xs font-semibold text-vermelho">responder</span>}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => <button type="button" key={o} className={"opcao " + (valor === o ? "opcao-ativa" : "")} onClick={() => aoEscolher(o)}>{o}{recomendado === o ? " (Recomendado)" : ""}</button>)}
        {outro && <input className={"campo w-56" + (livre ? " border-azul" : "")} placeholder="Outra: escreva aqui" value={livre ? valor : ""} aria-label={pergunta + " (outra)"} onChange={(e) => aoEscolher(e.target.value)} />}
      </div>
    </div>
  );
}

export function EditorBancada({ det, plantas, marcaDefinida, sigla }: { det: Detalhamento; plantas: ArquivoRef[]; marcaDefinida: boolean; sigla: string }) {
  const [d, setD] = useState<DadosBancada>(det.dados);
  const [planta, setPlanta] = useState<string>(det.plantaSituacao ?? "");
  const [saida, setSaida] = useState<{ pdf: string | null; verificacao: VerificacaoPrancha | null }>({ pdf: det.pdf, verificacao: det.verificacao });
  const [erros, setErros] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [sujo, setSujo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const mudar = (patch: Partial<DadosBancada>) => { setD((x) => ({ ...x, ...patch })); setSujo(true); setMsg(""); };
  const medida = (patch: Partial<DadosBancada>) => mudar({ ...patch, medidasConfirmadas: false });
  const abertas = perguntasEmAberto(d);
  const bloqueios = [...(abertas.length ? [] : errosBancada(d)), ...(marcaDefinida ? [] : [`A marca da ${sigla} está a definir. Cadastre em Empresas e marcas para gerar o documento.`])];
  const imagens = plantas.filter((p) => /\.(png|jpe?g)$/i.test(p.nome));
  const pecas = d.comprimento != null && d.profundidade != null && d.lateralEsquerda && d.lateralDireita ? pecasBancada(d) : [];

  const salvar = () => iniciar(async () => { const r = await salvarDetalhamento(det.id, d, planta || null); if (r.ok) { setSujo(false); setMsg("Rascunho salvo."); setErros([]); } else setErros(r.erros); });
  const gerar = () => iniciar(async () => {
    setMsg(""); setErros([]);
    const r = await salvarEGerarDetalhamento(det.id, d, planta || null);
    if (!r.ok) { setErros(r.erros); return; }
    setSujo(false); setSaida({ pdf: r.dados!.pdf, verificacao: r.dados!.verificacao }); setMsg("Prancha gerada.");
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="cartao space-y-4">
          <h2 className="titulo text-sm">1. Ambiente e carimbo</h2>
          <Opcoes pergunta="Qual o ambiente?" opcoes={AMBIENTES} valor={d.ambiente} aoEscolher={(v) => mudar({ ambiente: v, nomePrancha: d.nomePrancha || v })} outro />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="rotulo">Nome da prancha</span><input className="campo" value={d.nomePrancha} placeholder="Ex.: BWC Suíte" onChange={(e) => mudar({ nomePrancha: e.target.value })} /></label>
            <label className="block"><span className="rotulo">Data</span><input type="date" className="campo" value={d.data} onChange={(e) => mudar({ data: e.target.value })} /></label>
            <label className="block"><span className="rotulo">Cliente</span><input className={"campo" + (d.cliente ? "" : " campo-vazio")} value={d.cliente} placeholder="a definir" onChange={(e) => mudar({ cliente: e.target.value })} /></label>
            <label className="block"><span className="rotulo">Local (rua, bairro, cidade)</span><input className={"campo" + (d.local ? "" : " campo-vazio")} value={d.local} placeholder="a definir" onChange={(e) => mudar({ local: e.target.value })} /></label>
          </div>
          <p className="text-xs text-cinza">A numeração das folhas (01/02) é automática.</p>
        </section>

        <section className="cartao space-y-4">
          <h2 className="titulo text-sm">2. Medidas da bancada</h2>
          <p className="text-xs text-cinza">Digite em metros, como está cotado na planta. O sistema não estima medidas a partir da imagem.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Medida rotulo="Comprimento" valor={d.comprimento} aoMudar={(v) => medida({ comprimento: v })} />
            <Medida rotulo="Profundidade" valor={d.profundidade} aoMudar={(v) => medida({ profundidade: v })} dica="ex.: 0,55" />
          </div>
          {(["lateralEsquerda", "lateralDireita"] as const).map((k) => (
            <div key={k}>
              <p className="mb-1 text-sm font-semibold">Lateral {k === "lateralEsquerda" ? "esquerda" : "direita"} (olhando a bancada de frente) {!d[k] && <span className="ml-1 inline-flex rounded-full bg-vermelho/10 px-2 py-0.5 text-xs font-semibold text-vermelho">responder</span>}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={"opcao " + (d[k] === "parede" ? "opcao-ativa" : "")} onClick={() => medida({ [k]: "parede" })}>Encosta na parede (com frontão)</button>
                <button type="button" className={"opcao " + (d[k] === "aberta" ? "opcao-ativa" : "")} onClick={() => medida({ [k]: "aberta" })}>Aberta ao ambiente (sem frontão, com saia)</button>
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-[#F2F2F2] p-3 text-xs">
            <strong className="text-azul">Padrões fixos do escritório, aplicados sozinhos:</strong> tampo de 2 cm; frontão de 2 cm x 10 cm; saia de 20 cm; topo do tampo a {m2(PADRAO.alturaTampo)} do piso; cantos em meia esquadria.
          </div>
        </section>

        <section className="cartao space-y-4">
          <h2 className="titulo text-sm">3. Perguntas obrigatórias</h2>
          <Opcoes pergunta="Qual pedra será usada?" opcoes={PEDRAS} valor={d.pedra} aoEscolher={(v) => mudar({ pedra: v })} outro />
          <Opcoes pergunta="Qual o tipo de cuba?" opcoes={TIPOS_CUBA} valor={d.cubaTipo} aoEscolher={(v) => medida({ cubaTipo: v })} />
          {d.cubaTipo === "Esculpida" && <p className="rounded-lg bg-[#DDEBF7] p-2 text-xs">Cuba esculpida: fundo fixo, válvula click centralizada e faixa de escoamento de 1 cm (padrão do escritório).</p>}
          {temCuba(d) && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Medida rotulo="Cuba: largura (ao longo da bancada)" valor={d.cubaLargura} aoMudar={(v) => medida({ cubaLargura: v })} dica="ex.: 0,50" />
                <Medida rotulo="Cuba: profundidade (da frente ao fundo)" valor={d.cubaProfundidade} aoMudar={(v) => medida({ cubaProfundidade: v })} dica="ex.: 0,30" />
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold">Posição da cuba {d.cubaCentralizada == null && <span className="ml-1 inline-flex rounded-full bg-vermelho/10 px-2 py-0.5 text-xs font-semibold text-vermelho">responder</span>}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <button type="button" className={"opcao " + (d.cubaCentralizada === true ? "opcao-ativa" : "")} onClick={() => medida({ cubaCentralizada: true })}>Centralizada no comprimento</button>
                  <button type="button" className={"opcao " + (d.cubaCentralizada === false ? "opcao-ativa" : "")} onClick={() => medida({ cubaCentralizada: false })}>Outra posição</button>
                  {d.cubaCentralizada === false && <div className="w-64"><Medida rotulo="Eixo da cuba até a ponta esquerda" valor={d.cubaEixo} aoMudar={(v) => medida({ cubaEixo: v })} dica="ex.: 0,90" /></div>}
                </div>
                {d.cubaCentralizada === true && d.comprimento != null && <Calculo>Eixo da cuba = comprimento ÷ 2 = {deNumero(d.comprimento)} ÷ 2 = {m2(eixoCuba(d))} da ponta esquerda.</Calculo>}
              </div>
            </>
          )}
          <Opcoes pergunta="Qual o tipo de torneira?" opcoes={TIPOS_TORNEIRA} valor={d.torneira} aoEscolher={(v) => mudar({ torneira: v })} />
          <div>
            <p className="mb-1 text-sm font-semibold">Já há definição de revestimentos, cor da porta e pintura? {!d.revestimentosDefinidos && <span className="ml-1 inline-flex rounded-full bg-vermelho/10 px-2 py-0.5 text-xs font-semibold text-vermelho">responder</span>}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={"opcao " + (d.revestimentosDefinidos === "sim" ? "opcao-ativa" : "")} onClick={() => mudar({ revestimentosDefinidos: "sim" })}>Sim, vou informar</button>
              <button type="button" className={"opcao " + (d.revestimentosDefinidos === "nao" ? "opcao-ativa" : "")} onClick={() => mudar({ revestimentosDefinidos: "nao" })}>Ainda não (sai &quot;a definir&quot;)</button>
            </div>
            {d.revestimentosDefinidos === "sim" && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([["revestimentoPiso", "Piso"], ["revestimentoParede", "Parede"], ["corPorta", "Cor da porta"], ["pintura", "Pintura"]] as const).map(([k, r]) => (
                  <label key={k} className="block"><span className="rotulo">{r}</span><input className={"campo" + (d[k] ? "" : " campo-vazio")} value={d[k]} placeholder="a definir" onChange={(e) => mudar({ [k]: e.target.value })} /></label>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">4. Fixação (grapas)</h2>
          <p className="text-xs text-cinza">Barra de metalon 40x30 mm ou barra Ø40 mm, embutida cerca de 8 cm na parede, a 3 a 4 cm da saia e a no mínimo 5 cm do recorte. A folha 2 mostra só a opção escolhida.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([["A", "Opção A: 2 barras laterais", "Para bancadas curtas, até cerca de 1,00 m."], ["B", "Opção B: 4 barras", "2 laterais e 2 de reforço, para vãos maiores ou apoio de equipamentos."]] as const).map(([v, t, sub]) => (
              <button type="button" key={v} className={"opcao " + (d.grapas === v ? "opcao-ativa" : "")} onClick={() => mudar({ grapas: v })}>
                <strong className="block">{t}{d.comprimento != null && grapaRecomendada(d) === v ? " (Recomendado)" : ""}</strong><span className="text-xs opacity-80">{sub}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">5. Planta de situação e observações (opcional)</h2>
          {imagens.length === 0 ? <p className="text-xs text-cinza">Para a planta de situação aparecer na folha 2, envie a planta em PNG ou JPG na aba Arquivos do projeto. Sem ela, a folha 2 traz o detalhe ampliado da fixação.</p> : (
            <label className="block"><span className="rotulo">Planta para a folha 2</span>
              <select className="campo" value={planta} onChange={(e) => { setPlanta(e.target.value); setSujo(true); }}><option value="">Não incluir (mostrar o detalhe ampliado da fixação)</option>{imagens.map((p) => <option key={p.caminho} value={p.caminho}>{p.nome}</option>)}</select>
            </label>
          )}
          <label className="block"><span className="rotulo">Observações para a marmoraria</span><textarea className="campo" value={d.observacoes} onChange={(e) => mudar({ observacoes: e.target.value })} /></label>
        </section>

        {pecas.length > 0 && (
          <section className="cartao">
            <h2 className="titulo mb-2 text-sm">Lista de peças (medidas externas)</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {pecas.map((p) => (
                <div key={p.nome} className="rounded-xl bg-bege/40 p-3 text-sm">
                  <p className="font-semibold text-azul">{p.qtd} x {p.nome}</p>
                  <p>{m2(p.comprimento)} x {m2(p.largura)} x {m2(p.espessura)}</p>
                  <Calculo>{p.calculo}.</Calculo>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="cartao space-y-3">
          <h2 className="titulo text-sm">Gerar</h2>
          <label className={"flex cursor-pointer items-start gap-2 rounded-xl p-3 text-sm font-semibold " + (d.medidasConfirmadas ? "bg-verde/10 text-verde" : "bg-adefinir text-adefinir-texto")}>
            <input type="checkbox" className="mt-1" checked={d.medidasConfirmadas} onChange={(e) => { setD((x) => ({ ...x, medidasConfirmadas: e.target.checked })); setSujo(true); }} />
            Conferi as medidas com a planta
          </label>
          <button className="botao-ouro w-full" onClick={gerar} disabled={pendente || abertas.length > 0 || bloqueios.length > 0}>{pendente ? "Gerando..." : "Gerar prancha (PDF)"}</button>
          <button className="botao-leve w-full" onClick={salvar} disabled={pendente || !sujo}>Salvar rascunho</button>
          {bloqueios.map((b, i) => <p key={i} className="aviso">{b}</p>)}
          {erros.map((b, i) => <p key={"e" + i} className="aviso" role="alert">{b}</p>)}
          {msg && <p className="sucesso" role="status">{msg}</p>}
          {saida.pdf && (
            <div className="space-y-2 border-t border-begelinha pt-3">
              {sujo && <p className="text-xs text-adefinir-texto">Você mudou dados depois de gerar. Gere de novo para atualizar a prancha.</p>}
              <a className="botao w-full" href={`/api/arquivo?c=${encodeURIComponent(saida.pdf)}&ver=1`} target="_blank">Abrir PDF</a>
              {saida.verificacao && (
                <ul className="text-xs text-cinza">
                  <li>✓ {saida.verificacao.folhas} folhas, numeradas sozinhas</li>
                  <li>{saida.verificacao.sobreposicoes === 0 ? "✓ Nenhum texto ou cota sobreposto" : `✕ ${saida.verificacao.sobreposicoes} sobreposição(ões) encontradas`}</li>
                  {saida.verificacao.avisos.map((a, i) => <li key={i} className="text-vermelho">{a}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="cartao">
          <h2 className="titulo mb-2 text-sm">Responder antes de gerar ({abertas.length})</h2>
          {abertas.length === 0 ? <p className="text-sm text-verde">Todas as perguntas respondidas.</p> : (
            <>
              <ul className="space-y-1 text-sm">{abertas.map((x) => <li key={x} className="rounded-lg bg-vermelho/5 px-3 py-1.5 text-vermelho">{x}</li>)}</ul>
              <p className="mt-2 text-xs text-cinza">Na marmoraria nada sai &quot;a definir&quot;: a prancha só é gerada com pedra, cuba, torneira e medidas respondidas.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
