"use client";
import { useState, useTransition } from "react";
import { lerAmbientesDaPlanta, salvarConjuntoMolhadas, salvarEGerarConjuntoMolhadas } from "@/app/acoes";
import { TIPOS_BOX, TIPOS_CHUVEIRO, TIPOS_VASO, ativos, errosDoAmbiente, perguntasDoAmbiente, type Ambiente, type ParametroNBR, type Parede, type RespostasAmbiente } from "@/lib/pranchas/ambiente";
import { PEDRAS, TIPOS_CUBA, TIPOS_TORNEIRA } from "@/lib/pranchas/regras-bancada";
import type { ArquivoRef, ConjuntoMolhadas, SaidaPrancha } from "@/lib/tipos";
import { PreviaAmbiente } from "./PreviaAmbiente";
import { MarcarNaPlanta } from "./MarcarNaPlanta";

const paraNumero = (v: string): number | null => { if (!v.trim()) return null; const n = Number(v.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const deNumero = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const PAREDES: [Parede, string][] = [["N", "de cima"], ["S", "de baixo"], ["O", "da esquerda"], ["L", "da direita"]];
const RESPONDER = <span className="ml-1 inline-flex rounded-full bg-vermelho/10 px-2 py-0.5 text-xs font-semibold text-vermelho">responder</span>;

function Num({ rotulo, valor, aoMudar }: { rotulo: string; valor: number | null | undefined; aoMudar: (v: number) => void }) {
  const [t, setT] = useState(deNumero(valor));
  return <label className="block text-xs"><span className="text-cinza">{rotulo}</span><input className="campo px-2 py-1" inputMode="decimal" value={t} aria-label={rotulo} onChange={(e) => { setT(e.target.value); const n = paraNumero(e.target.value); if (n != null) aoMudar(n); }} /></label>;
}
function Par({ valor, aoMudar, rotulo }: { valor: Parede; aoMudar: (p: Parede) => void; rotulo: string }) {
  return <label className="block text-xs"><span className="text-cinza">{rotulo}</span><select className="campo px-2 py-1" value={valor} aria-label={rotulo} onChange={(e) => aoMudar(e.target.value as Parede)}>{PAREDES.map(([p, n]) => <option key={p} value={p}>Parede {n}</option>)}</select></label>;
}
function Opcoes({ pergunta, opcoes, valor, aoEscolher, outro }: { pergunta: string; opcoes: readonly string[]; valor: string; aoEscolher: (v: string) => void; outro?: boolean }) {
  const livre = valor !== "" && !opcoes.includes(valor);
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{pergunta} {!valor && RESPONDER}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => <button type="button" key={o} className={"opcao " + (valor === o ? "opcao-ativa" : "")} onClick={() => aoEscolher(o)}>{o}</button>)}
        {outro && <input className={"campo w-56" + (livre ? " border-azul" : "")} placeholder="Outra: escreva aqui" value={livre ? valor : ""} aria-label={pergunta + " (outra)"} onChange={(e) => aoEscolher(e.target.value)} />}
      </div>
    </div>
  );
}
const SimNao = ({ pergunta, valor, aoEscolher, sim = "Sim", nao = "Não" }: { pergunta: string; valor: string; aoEscolher: (v: "sim" | "nao") => void; sim?: string; nao?: string }) => (
  <div>
    <p className="mb-1 text-sm font-semibold">{pergunta} {!valor && RESPONDER}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={"opcao " + (valor === "sim" ? "opcao-ativa" : "")} onClick={() => aoEscolher("sim")}>{sim}</button>
      <button type="button" className={"opcao " + (valor === "nao" ? "opcao-ativa" : "")} onClick={() => aoEscolher("nao")}>{nao}</button>
    </div>
  </div>
);
const novoAmbiente = (n: number): Ambiente => ({ nome: `BWC ${n}`, largura: 1.5, comprimento: 2, espessuraParede: 0.15, porta: null, box: null, chuveiro: null, ralo: null, vasos: [], bancadas: [], acessivel: "", observacoesLeitura: "" });

export function EditorMolhadas({ cj, plantas, iaLigada, marcaDefinida, sigla }: { cj: ConjuntoMolhadas; plantas: ArquivoRef[]; iaLigada: boolean; marcaDefinida: boolean; sigla: string }) {
  const [ambientes, setAmbientes] = useState<Ambiente[]>(cj.ambientes);
  const [r, setR] = useState<RespostasAmbiente>(cj.respostas);
  const [parametros, setParametros] = useState<ParametroNBR[]>(cj.parametros);
  const [planta, setPlanta] = useState(cj.planta ?? plantas[0]?.caminho ?? "");
  const [saidas, setSaidas] = useState<SaidaPrancha[]>(cj.saidas);
  const [avisos, setAvisos] = useState<string[]>(cj.avisos);
  const [erros, setErros] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [leitura, setLeitura] = useState("");
  const [sujo, setSujo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [versao, setVersao] = useState(0); // força os campos de número a recarregar depois de uma leitura

  const mexeu = () => { setSujo(true); setMsg(""); };
  const resp = (patch: Partial<RespostasAmbiente>) => { setR((x) => ({ ...x, ...patch })); mexeu(); };
  // qualquer mudança no desenho exige conferir de novo
  const amb = (i: number, patch: Partial<Ambiente>) => { setAmbientes((l) => l.map((a, k) => (k === i ? { ...a, ...patch } : a))); setR((x) => ({ ...x, modeloConferido: false })); mexeu(); };
  const ambSemDesconferir = (i: number, patch: Partial<Ambiente>) => { setAmbientes((l) => l.map((a, k) => (k === i ? { ...a, ...patch } : a))); mexeu(); };

  const dados = () => ({ planta: planta || null, ambientes, respostas: r, parametros });
  const escolhidos = ativos(ambientes);
  const abertas = [...new Set(escolhidos.flatMap((a) => perguntasDoAmbiente(a, r)))];
  const bloqueios = [
    ...(ambientes.length === 0 ? ["Leia a planta ou adicione um ambiente."] : escolhidos.length === 0 ? ["Marque ao menos um ambiente para detalhar."] : []),
    ...(abertas.length ? [] : [...new Set(escolhidos.flatMap((a) => errosDoAmbiente(a, r)))]),
    ...(marcaDefinida ? [] : [`A marca da ${sigla} está a definir. Cadastre em Empresas e marcas para gerar o documento.`]),
  ];
  const temBancada = escolhidos.some((a) => a.bancadas.length), temCuba = escolhidos.some((a) => a.bancadas.some((b) => b.cubas.length));
  const temVaso = escolhidos.some((a) => a.vasos.length), temChuveiro = escolhidos.some((a) => a.chuveiro), temBox = escolhidos.some((a) => a.box);
  const temPNE = escolhidos.some((a) => a.acessivel === "sim");

  const ler = () => iniciar(async () => {
    setErros([]); setLeitura("");
    const res = await lerAmbientesDaPlanta(cj.id, planta);
    if (!res.ok) { setErros(res.erros); return; }
    setAmbientes(res.dados!.ambientes); setVersao((v) => v + 1);
    setR((x) => ({ ...x, modeloConferido: false, origemPlanta: plantas.find((p) => p.caminho === planta)?.nome ?? x.origemPlanta }));
    setLeitura(`Li ${res.dados!.ambientes.length} ambiente(s). ${res.dados!.observacoes} Compare cada desenho abaixo com a planta antes de gerar.`); mexeu();
  });
  const salvar = () => iniciar(async () => { const res = await salvarConjuntoMolhadas(cj.id, dados()); if (res.ok) { setSujo(false); setMsg("Rascunho salvo."); setErros([]); } else setErros(res.erros); });
  const gerar = () => iniciar(async () => {
    setMsg(""); setErros([]);
    const res = await salvarEGerarConjuntoMolhadas(cj.id, dados());
    if (!res.ok) { setErros(res.erros); return; }
    setSujo(false); setSaidas(res.dados!.saidas); setAvisos(res.dados!.avisos); setMsg(`${res.dados!.saidas.length} prancha(s) gerada(s).`);
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">1. Planta baixa</h2>
          {plantas.length === 0 ? <p className="text-sm text-cinza">Nenhuma planta enviada neste projeto. Envie na aba Arquivos do projeto (PNG, JPG ou PDF) e volte aqui.</p> : (
            <div className="flex flex-wrap items-center gap-2">
              <select className="campo w-auto grow" value={planta} onChange={(e) => { setPlanta(e.target.value); mexeu(); }} aria-label="Planta">{plantas.map((p) => <option key={p.caminho} value={p.caminho}>{p.nome}</option>)}</select>
              {planta && <a className="botao-leve" href={`/api/arquivo?c=${encodeURIComponent(planta)}&ver=1`} target="_blank">Abrir planta</a>}
              <button type="button" className="botao" onClick={ler} disabled={pendente || !planta}>{pendente ? "Lendo a planta..." : "Ler a planta e montar os ambientes"}</button>
            </div>
          )}
          <p className="text-xs text-cinza">{iaLigada ? "PDF exportado do programa de desenho é lido pelo texto e pelo traço. Foto ou imagem da planta é lida por inteligência artificial." : "Sem a chave da API do Claude, a leitura funciona com PDF exportado direto do programa de desenho, com cotas e nomes dos ambientes. Foto ou imagem: adicione o ambiente à mão."}</p>
          {leitura && <p className="rounded-lg bg-[#DDEBF7] p-2 text-xs">{leitura}</p>}
          <button type="button" className="botao-leve" onClick={() => { setAmbientes((l) => [...l, novoAmbiente(l.length + 1)]); setR((x) => ({ ...x, modeloConferido: false })); mexeu(); }}>+ Adicionar ambiente à mão</button>
        </section>

        {ambientes.length > 0 && (
          <section className="cartao space-y-2" aria-label="Quais ambientes detalhar">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="titulo grow text-sm">Quais ambientes detalhar? ({escolhidos.length} de {ambientes.length})</h2>
              <button type="button" className="botao-leve" onClick={() => { setAmbientes((l) => l.map((a) => ({ ...a, incluir: true }))); mexeu(); }}>Marcar todos</button>
              <button type="button" className="botao-leve" onClick={() => { setAmbientes((l) => l.map((a) => ({ ...a, incluir: false }))); mexeu(); }}>Desmarcar todos</button>
            </div>
            <p className="text-xs text-cinza">Só os marcados entram nas perguntas e nas pranchas. Os desmarcados ficam guardados, sem apagar.</p>
            <div className="flex flex-wrap gap-2">
              {ambientes.map((a, i) => (
                <label key={i} className={"opcao flex cursor-pointer items-center gap-2 " + (a.incluir !== false ? "opcao-ativa" : "")}>
                  <input type="checkbox" checked={a.incluir !== false} aria-label={`Detalhar ${a.nome}`} onChange={(e) => { setAmbientes((l) => l.map((x, k) => (k === i ? { ...x, incluir: e.target.checked } : x))); mexeu(); }} />
                  {a.nome}
                </label>
              ))}
            </div>
          </section>
        )}

        {ambientes.map((a, i) => (
          <section key={`${versao}-${i}`} className={"cartao space-y-3" + (a.incluir === false ? " opacity-60" : "")}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="titulo grow text-sm">Ambiente: <input className="campo ml-1 inline w-48 py-1 font-semibold" value={a.nome} aria-label={`Nome do ambiente ${i + 1}`} onChange={(e) => ambSemDesconferir(i, { nome: e.target.value })} /></h2>
              <button type="button" className="text-sm text-vermelho underline" onClick={() => { setAmbientes((l) => l.filter((_, k) => k !== i)); mexeu(); }}>Remover</button>
            </div>
            {a.incluir === false && <p className="text-sm text-cinza">Este ambiente não será detalhado. Marque a caixa no topo para incluí-lo.</p>}
            <div className={a.incluir === false ? "hidden" : "space-y-3"}>
            {a.recorte && <MarcarNaPlanta a={a} aoMudar={(patch) => amb(i, patch)} />}
            <div className="flex flex-wrap gap-4">
              <div><p className="mb-1 text-xs text-cinza">Como vai para a prancha:</p><PreviaAmbiente a={a} /></div>
              <div className="min-w-56 grow space-y-2 text-sm">
                <p><strong>{deNumero(a.largura)} x {deNumero(a.comprimento)} m</strong> (largura x comprimento, por dentro)</p>
                <ul className="list-inside list-disc text-cinza">
                  <li>{a.porta ? `Porta de ${deNumero(a.porta.largura)} m na parede ${PAREDES.find(([p]) => p === a.porta!.parede)![1]}, abrindo para ${a.porta.abre}` : "Sem porta lida"}</li>
                  <li>{a.vasos.length ? `${a.vasos.length} vaso(s)` : "Sem vaso"}; {a.bancadas.length ? `${a.bancadas.length} bancada(s) com ${a.bancadas.reduce((n, b) => n + b.cubas.length, 0)} cuba(s)` : "sem bancada"}</li>
                  <li>{a.box ? `Box com ${deNumero(a.box.profundidade)} m` : "Sem box"}{a.chuveiro ? ", com chuveiro" : ""}{a.ralo ? ", ralo marcado" : ""}</li>
                </ul>
                {a.observacoesLeitura && <p className="rounded-lg bg-adefinir/60 p-2 text-xs">Leitura: {a.observacoesLeitura}</p>}
                {a.vasos.length > 0 && <SimNao pergunta="Terá barras de acessibilidade (PNE)?" valor={a.acessivel} aoEscolher={(v) => ambSemDesconferir(i, { acessivel: v })} sim="Sim, locar pela NBR 9050" nao="Não" />}
              </div>
            </div>
            <details className="rounded-xl bg-bege/30 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-azul">Corrigir medidas e posições digitando</summary>
              <p className="my-2 text-xs text-cinza">Medidas em metros. Nas paredes de cima e de baixo, as posições são medidas a partir da parede da esquerda; nas paredes da esquerda e da direita, a partir da parede de cima.</p>
              <div className="grid gap-2 sm:grid-cols-4">
                <Num rotulo="Largura (horizontal)" valor={a.largura} aoMudar={(v) => amb(i, { largura: v })} />
                <Num rotulo="Comprimento (vertical)" valor={a.comprimento} aoMudar={(v) => amb(i, { comprimento: v })} />
              </div>
              <p className="mt-3 text-xs font-semibold text-azul">Porta</p>
              {a.porta ? (
                <div className="grid items-end gap-2 sm:grid-cols-6">
                  <Par rotulo="Parede" valor={a.porta.parede} aoMudar={(p) => amb(i, { porta: { ...a.porta!, parede: p } })} />
                  <Num rotulo="Início do vão" valor={a.porta.inicio} aoMudar={(v) => amb(i, { porta: { ...a.porta!, inicio: v } })} />
                  <Num rotulo="Largura do vão" valor={a.porta.largura} aoMudar={(v) => amb(i, { porta: { ...a.porta!, largura: v } })} />
                  <label className="block text-xs"><span className="text-cinza">Abre para</span><select className="campo px-2 py-1" value={a.porta.abre} onChange={(e) => amb(i, { porta: { ...a.porta!, abre: e.target.value as "dentro" | "fora" } })}><option value="dentro">Dentro</option><option value="fora">Fora</option></select></label>
                  <label className="block text-xs"><span className="text-cinza">Dobradiça</span><select className="campo px-2 py-1" value={a.porta.dobradica} onChange={(e) => amb(i, { porta: { ...a.porta!, dobradica: e.target.value as "inicio" | "fim" } })}><option value="inicio">No início do vão</option><option value="fim">No fim do vão</option></select></label>
                  <button type="button" className="botao-leve py-1" onClick={() => amb(i, { porta: null })}>Tirar</button>
                </div>
              ) : <button type="button" className="botao-leve py-1" onClick={() => amb(i, { porta: { parede: "S", inicio: 0.1, largura: 0.8, altura: 2.1, abre: "dentro", dobradica: "inicio" } })}>+ Porta</button>}
              <p className="mt-3 text-xs font-semibold text-azul">Vasos</p>
              {a.vasos.map((v, k) => (
                <div key={k} className="grid items-end gap-2 sm:grid-cols-6">
                  <Par rotulo="Parede em que encosta" valor={v.parede} aoMudar={(p) => amb(i, { vasos: a.vasos.map((x, n) => (n === k ? { ...x, parede: p } : x)) })} />
                  <Num rotulo="Eixo do vaso" valor={v.eixo} aoMudar={(e) => amb(i, { vasos: a.vasos.map((x, n) => (n === k ? { ...x, eixo: e } : x)) })} />
                  <button type="button" className="botao-leve py-1" onClick={() => amb(i, { vasos: a.vasos.filter((_, n) => n !== k) })}>Tirar</button>
                </div>
              ))}
              <button type="button" className="botao-leve mt-1 py-1" onClick={() => amb(i, { vasos: [...a.vasos, { parede: "N", eixo: 0.5 }] })}>+ Vaso</button>
              <p className="mt-3 text-xs font-semibold text-azul">Bancadas</p>
              {a.bancadas.map((b, k) => {
                const mb = (patch: Partial<typeof b>) => amb(i, { bancadas: a.bancadas.map((x, n) => (n === k ? { ...x, ...patch } : x)) });
                return (
                  <div key={k} className="grid items-end gap-2 sm:grid-cols-6">
                    <Par rotulo="Parede do fundo" valor={b.parede} aoMudar={(p) => mb({ parede: p })} />
                    <Num rotulo="Início" valor={b.inicio} aoMudar={(v) => mb({ inicio: v })} />
                    <Num rotulo="Comprimento" valor={b.comprimento} aoMudar={(v) => mb({ comprimento: v })} />
                    <Num rotulo="Profundidade" valor={b.profundidade} aoMudar={(v) => mb({ profundidade: v })} />
                    <label className="block text-xs"><span className="text-cinza">Eixo das cubas (separe com ;)</span><input className="campo px-2 py-1" defaultValue={b.cubas.map(deNumero).join("; ")} aria-label="Eixo das cubas" onChange={(e) => mb({ cubas: e.target.value.split(";").map((x) => paraNumero(x)).filter((x): x is number => x != null) })} /></label>
                    <button type="button" className="botao-leve py-1" onClick={() => amb(i, { bancadas: a.bancadas.filter((_, n) => n !== k) })}>Tirar</button>
                  </div>
                );
              })}
              <button type="button" className="botao-leve mt-1 py-1" onClick={() => amb(i, { bancadas: [...a.bancadas, { parede: "L", inicio: 0, comprimento: 0.8, profundidade: 0.5, cubas: [0.4] }] })}>+ Bancada</button>
              <p className="mt-3 text-xs font-semibold text-azul">Box, chuveiro e ralo</p>
              <div className="grid items-end gap-2 sm:grid-cols-6">
                {a.box ? <><Par rotulo="Box encosta na" valor={a.box.parede} aoMudar={(p) => amb(i, { box: { ...a.box!, parede: p } })} /><Num rotulo="Profundidade do box" valor={a.box.profundidade} aoMudar={(v) => amb(i, { box: { ...a.box!, profundidade: v } })} /><button type="button" className="botao-leve py-1" onClick={() => amb(i, { box: null })}>Tirar box</button></> : <button type="button" className="botao-leve py-1" onClick={() => amb(i, { box: { parede: "O", profundidade: 0.9 } })}>+ Box</button>}
                {a.chuveiro ? <><Par rotulo="Chuveiro na" valor={a.chuveiro.parede} aoMudar={(p) => amb(i, { chuveiro: { ...a.chuveiro!, parede: p } })} /><Num rotulo="Posição do chuveiro" valor={a.chuveiro.pos} aoMudar={(v) => amb(i, { chuveiro: { ...a.chuveiro!, pos: v } })} /><button type="button" className="botao-leve py-1" onClick={() => amb(i, { chuveiro: null })}>Tirar chuveiro</button></> : <button type="button" className="botao-leve py-1" onClick={() => amb(i, { chuveiro: { parede: "N", pos: 0.45, registros: 1 } })}>+ Chuveiro</button>}
              </div>
              <div className="mt-2 grid items-end gap-2 sm:grid-cols-6">
                {a.ralo ? <><Num rotulo="Ralo: distância da esquerda" valor={a.ralo.x} aoMudar={(v) => amb(i, { ralo: { ...a.ralo!, x: v } })} /><Num rotulo="Ralo: distância de cima" valor={a.ralo.y} aoMudar={(v) => amb(i, { ralo: { ...a.ralo!, y: v } })} /><button type="button" className="botao-leve py-1" onClick={() => amb(i, { ralo: null })}>Tirar ralo</button></> : <button type="button" className="botao-leve py-1" onClick={() => amb(i, { ralo: { x: 0.2, y: 0.2 } })}>+ Ralo</button>}
              </div>
            </details>
            </div>
          </section>
        ))}

        {ambientes.length > 0 && (
          <section className="cartao space-y-4">
            <h2 className="titulo text-sm">2. Perguntas obrigatórias</h2>
            <p className="text-xs text-cinza">Valem para todos os ambientes deste conjunto. Sem estas respostas as pranchas não são geradas.</p>
            {temBancada && <Opcoes pergunta="Qual pedra será usada nas bancadas?" opcoes={PEDRAS} valor={r.pedra} aoEscolher={(v) => resp({ pedra: v })} outro />}
            {temCuba && <Opcoes pergunta="Qual o tipo de cuba?" opcoes={TIPOS_CUBA.filter((x) => x !== "Sem cuba")} valor={r.cubaTipo} aoEscolher={(v) => resp({ cubaTipo: v })} />}
            {temCuba && r.cubaTipo && (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block"><span className="rotulo">Cuba: largura (m) {r.cubaLargura == null && RESPONDER}</span><input className="campo" inputMode="decimal" placeholder="ex.: 0,30" defaultValue={deNumero(r.cubaLargura)} aria-label="Cuba: largura" onChange={(e) => resp({ cubaLargura: paraNumero(e.target.value) })} /></label>
                <label className="block"><span className="rotulo">Cuba: profundidade (m) {r.cubaProfundidade == null && RESPONDER}</span><input className="campo" inputMode="decimal" placeholder="ex.: 0,30" defaultValue={deNumero(r.cubaProfundidade)} aria-label="Cuba: profundidade" onChange={(e) => resp({ cubaProfundidade: paraNumero(e.target.value) })} /></label>
              </div>
            )}
            {temCuba && <Opcoes pergunta="Qual o tipo de torneira?" opcoes={TIPOS_TORNEIRA.filter((x) => x !== "Sem torneira")} valor={r.torneira} aoEscolher={(v) => resp({ torneira: v })} />}
            {temVaso && <Opcoes pergunta="Qual o tipo de vaso sanitário?" opcoes={TIPOS_VASO} valor={r.vasoTipo} aoEscolher={(v) => resp({ vasoTipo: v })} />}
            {temBancada && <SimNao pergunta="Haverá espelho sobre a bancada?" valor={r.espelho} aoEscolher={(v) => resp({ espelho: v })} sim="Sim (de 1,15 a 2,10 m)" />}
            {temChuveiro && <Opcoes pergunta="Qual o tipo de chuveiro?" opcoes={TIPOS_CHUVEIRO} valor={r.chuveiroTipo} aoEscolher={(v) => resp({ chuveiroTipo: v })} />}
            {temBox && <Opcoes pergunta="Como será o box?" opcoes={TIPOS_BOX} valor={r.boxTipo} aoEscolher={(v) => resp({ boxTipo: v })} />}
            <SimNao pergunta="Já há definição de revestimentos, cor da porta e pintura?" valor={r.revestimentosDefinidos} aoEscolher={(v) => resp({ revestimentosDefinidos: v })} sim="Sim, vou informar" nao={'Ainda não (sai "a definir")'} />
            {r.revestimentosDefinidos === "sim" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {([["revestimentoPiso", "Piso"], ["revestimentoParede", "Parede"], ["corPorta", "Cor da porta"], ["pintura", "Pintura"]] as const).map(([k, rot]) => (
                  <label key={k} className="block"><span className="rotulo">{rot}</span><input className={"campo" + (r[k] ? "" : " campo-vazio")} value={r[k]} placeholder="a definir" onChange={(e) => resp({ [k]: e.target.value })} /></label>
                ))}
              </div>
            )}
            <div className="grid gap-3 border-t border-begelinha pt-3 sm:grid-cols-2">
              <label className="block"><span className="rotulo">Cliente (carimbo)</span><input className={"campo" + (r.cliente ? "" : " campo-vazio")} value={r.cliente} placeholder="a definir" onChange={(e) => resp({ cliente: e.target.value })} /></label>
              <label className="block"><span className="rotulo">Local (rua, bairro, cidade)</span><input className={"campo" + (r.local ? "" : " campo-vazio")} value={r.local} placeholder="a definir" onChange={(e) => resp({ local: e.target.value })} /></label>
              <label className="block"><span className="rotulo">Data</span><input type="date" className="campo" value={r.data} onChange={(e) => resp({ data: e.target.value })} /></label>
            </div>
          </section>
        )}

        {temPNE && (
          <section className="cartao space-y-2">
            <h2 className="titulo text-sm">3. Barras de apoio: ABNT NBR 9050:2020</h2>
            <p className="text-xs text-cinza">As barras são locadas sozinhas com estas medidas, tiradas dos itens indicados da norma. Só o comprimento da bacia depende do modelo escolhido.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {parametros.map((p, i) => (
                <label key={p.chave} className="block rounded-lg bg-bege/30 p-2 text-xs">
                  <span className="block font-semibold">{p.rotulo}</span><span className="block text-cinza">{p.item.startsWith("não") ? p.item : `Item ${p.item}`}</span>
                  <input className="campo mt-1 w-24 px-2 py-1" inputMode="decimal" defaultValue={deNumero(p.valor)} aria-label={p.rotulo} onChange={(e) => { const n = paraNumero(e.target.value); if (n != null) { setParametros((l) => l.map((x, k) => (k === i ? { ...x, valor: n } : x))); mexeu(); } }} /> m
                </label>
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="cartao space-y-3">
          <h2 className="titulo text-sm">Gerar</h2>
          <label className={"flex cursor-pointer items-start gap-2 rounded-xl p-3 text-sm font-semibold " + (r.modeloConferido ? "bg-verde/10 text-verde" : "bg-adefinir text-adefinir-texto")}>
            <input type="checkbox" className="mt-1" checked={r.modeloConferido} disabled={ambientes.length === 0} onChange={(e) => { setR((x) => ({ ...x, modeloConferido: e.target.checked })); mexeu(); }} />
            Comparei cada desenho com a planta e está correto
          </label>
          <button className="botao-ouro w-full" onClick={gerar} disabled={pendente || abertas.length > 0 || bloqueios.length > 0}>{pendente ? "Gerando..." : "Gerar todas as pranchas"}</button>
          <button className="botao-leve w-full" onClick={salvar} disabled={pendente || !sujo}>Salvar rascunho</button>
          {bloqueios.map((b, i) => <p key={i} className="aviso">{b}</p>)}
          {erros.map((b, i) => <p key={"e" + i} className="aviso" role="alert">{b}</p>)}
          {msg && <p className="sucesso" role="status">{msg}</p>}
          {saidas.length > 0 && (
            <ul className="space-y-2 border-t border-begelinha pt-3">
              {sujo && <li className="text-xs text-adefinir-texto">Você mudou dados depois de gerar. Gere de novo para atualizar.</li>}
              {saidas.map((s) => (
                <li key={s.pdf} className="text-sm">
                  <a className="font-semibold text-azul underline" href={`/api/arquivo?c=${encodeURIComponent(s.pdf)}&ver=1`} target="_blank">{s.nome}</a>
                  <span className={"block text-xs " + (s.sobreposicoes ? "text-vermelho" : "text-cinza")}>{s.sobreposicoes ? `✕ ${s.sobreposicoes} sobreposição(ões): revisar` : "✓ sem texto ou cota sobreposto"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {avisos.length > 0 && (
          <div className="cartao"><h2 className="titulo mb-2 text-sm">Avisos para conferir ({avisos.length})</h2><ul className="space-y-1 text-xs">{avisos.map((a) => <li key={a} className="rounded-lg bg-adefinir/60 px-3 py-1.5">{a}</li>)}</ul></div>
        )}
        <div className="cartao">
          <h2 className="titulo mb-2 text-sm">Responder antes de gerar ({abertas.length})</h2>
          {abertas.length === 0 ? <p className="text-sm text-verde">{ambientes.length ? "Todas as perguntas respondidas." : "Comece pela planta."}</p> : <ul className="space-y-1 text-sm">{abertas.map((x) => <li key={x} className="rounded-lg bg-vermelho/5 px-3 py-1.5 text-vermelho">{x}</li>)}</ul>}
        </div>
      </aside>
    </div>
  );
}
