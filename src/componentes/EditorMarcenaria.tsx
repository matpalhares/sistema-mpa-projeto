"use client";
import { useRef, useState, useTransition } from "react";
import { lerModeloMarcenaria, prepararPlantaMarcenaria, recortarAmbienteMarcenaria, salvarEGerarMarcenaria, salvarMarcenaria } from "@/app/acoes";
import { CORREDICAS, DOBRADICAS, ESPESSURAS, NOME_PAPEL, PAPEIS, PUXADORES, TIPOS_PORTA, errosDoMovelParam, espCaixaMm, moduloNovo, movelParamNovo, movelPorMedidas, perguntasDoMovelParam, perguntasMarcenaria, type ModuloParam, type MovelParam, type Papel, type RespostasMarcenaria } from "@/lib/marcenaria/modelo";
import type { ArquivoRef, ConjuntoMarcenaria, MovelLido, PlantaMarcenaria, RecorteMarcenaria, VerificacaoPrancha } from "@/lib/tipos";
import { EnvioArquivo } from "./EnvioArquivo";

const inteiro = (v: string): number | null => { const n = Number(v.replace(",", ".")); return v.trim() && Number.isFinite(n) ? Math.round(n) : null; };
const arq = (c: string, ver = true) => `/api/arquivo?c=${encodeURIComponent(c)}${ver ? "&ver=1" : ""}`;
const Falta = () => <span className="ml-1 inline-flex rounded-full bg-vermelho/10 px-2 py-0.5 text-xs font-semibold text-vermelho">responder</span>;

function Opcoes({ pergunta, opcoes, valor, aoEscolher, outro }: { pergunta: string; opcoes: readonly string[]; valor: string; aoEscolher: (v: string) => void; outro?: boolean }) {
  const livre = valor !== "" && !opcoes.includes(valor);
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{pergunta} {!valor && <Falta />}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => <button type="button" key={o} className={"opcao " + (valor === o ? "opcao-ativa" : "")} onClick={() => aoEscolher(o)}>{o}</button>)}
        {outro && <input className={"campo w-56" + (livre ? " border-azul" : "")} placeholder="Outro: escreva aqui" value={livre ? valor : ""} aria-label={pergunta + " (outro)"} onChange={(e) => aoEscolher(e.target.value)} />}
      </div>
    </div>
  );
}
function Mm({ rotulo, valor, aoMudar, dica }: { rotulo: string; valor: number | null; aoMudar: (v: number | null) => void; dica?: string }) {
  return (
    <label className="block"><span className="rotulo">{rotulo} (mm)</span>
      <input className={"campo" + (valor == null ? " campo-vazio" : "")} inputMode="numeric" placeholder={dica ?? "a definir"} value={valor ?? ""} onChange={(e) => aoMudar(inteiro(e.target.value))} />
    </label>
  );
}
function Numero({ pergunta, valor, de, ate, aoEscolher }: { pergunta: string; valor: number; de: number; ate: number; aoEscolher: (n: number) => void }) {
  return (
    <div><p className="mb-1 text-xs font-semibold text-cinza">{pergunta}</p>
      <div className="flex flex-wrap gap-1">{Array.from({ length: ate - de + 1 }, (_, i) => de + i).map((n) => <button type="button" key={n} className={"opcao px-2.5 py-1 " + (valor === n ? "opcao-ativa" : "")} onClick={() => aoEscolher(n)}>{n}</button>)}</div>
    </div>
  );
}

// Desenho de frente do móvel por medidas, para conferir antes de gerar.
function PreviaMovel({ m, r }: { m: MovelParam; r: RespostasMarcenaria }) {
  if (m.L == null || m.P == null || m.A == null || perguntasDoMovelParam(m, { ...r, alturaLateralGaveta: r.alturaLateralGaveta ?? 100 }).length) return <p className="adefinir">O desenho aparece quando as medidas e os módulos estiverem respondidos.</p>;
  const mv = movelPorMedidas(m, r), W = 300, s = Math.min(W / mv.L, 220 / mv.A), H = mv.A * s;
  return (
    <svg width={W + 8} height={H + 8} role="img" aria-label={`Frente do móvel ${m.nome}`} className="rounded-lg bg-white">
      {[...mv.pecas].sort((a, b) => b.y0 - a.y0).filter((p) => !["lateral_gaveta", "traseira_gaveta", "fundo_gaveta"].includes(p.papel)).map((p, i) => (
        <rect key={i} x={4 + p.x0 * s} y={4 + (mv.A - p.z1) * s} width={Math.max(0.5, (p.x1 - p.x0) * s)} height={Math.max(0.5, (p.z1 - p.z0) * s)} fill={p.papel === "porta" || p.papel === "frente_gaveta" ? "#CBB896" : "#EFE8D8"} stroke="#1a1a1a" strokeWidth={0.6} />
      ))}
    </svg>
  );
}

// Recorte da planta em volta do ambiente: dois cliques nos cantos opostos do móvel dão largura e profundidade.
function MedirNaPlanta({ rec, aoMedir }: { rec: RecorteMarcenaria; aoMedir: (L: number, P: number) => void }) {
  const [p1, setP1] = useState<[number, number] | null>(null);
  const [p2, setP2] = useState<[number, number] | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const clicar = (e: React.MouseEvent) => {
    const b = svg.current!.getBoundingClientRect(), x = ((e.clientX - b.left) / b.width) * rec.largura, y = ((e.clientY - b.top) / b.height) * rec.altura;
    if (!p1 || p2) { setP1([x, y]); setP2(null); return; }
    setP2([x, y]);
    const a = Math.round((Math.abs(x - p1[0]) / rec.pxPorM) * 100) * 10, c = Math.round((Math.abs(y - p1[1]) / rec.pxPorM) * 100) * 10; // arredonda para 1 cm
    aoMedir(Math.max(a, c), Math.min(a, c));
  };
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-azul">{!p1 || p2 ? "Clique em um canto do móvel na planta." : "Agora clique no canto oposto (na diagonal)."} A maior medida vira a largura e a menor, a profundidade.</p>
      <div className="max-h-[520px] overflow-auto rounded-lg border border-begelinha">
        <svg ref={svg} viewBox={`0 0 ${rec.largura} ${rec.altura}`} width={rec.largura} className="cursor-crosshair" onClick={clicar} role="img" aria-label="Planta para medir o móvel">
          <image href={arq(rec.imagem)} width={rec.largura} height={rec.altura} />
          {p1 && <circle cx={p1[0]} cy={p1[1]} r={5} fill="#B3261E" />}
          {p1 && p2 && <rect x={Math.min(p1[0], p2[0])} y={Math.min(p1[1], p2[1])} width={Math.abs(p2[0] - p1[0])} height={Math.abs(p2[1] - p1[1])} fill="#0D2F6333" stroke="#0D2F63" strokeWidth={2} />}
        </svg>
      </div>
    </div>
  );
}

export function EditorMarcenaria({ cj, projetoId, modelos, plantas, marcaDefinida, sigla }: { cj: ConjuntoMarcenaria; projetoId: string; modelos: ArquivoRef[]; plantas: ArquivoRef[]; marcaDefinida: boolean; sigla: string }) {
  const [escolhido, setArquivo] = useState<string | null>(cj.arquivo);
  const arquivo = escolhido ?? modelos[modelos.length - 1]?.caminho ?? ""; // sem escolha: o último arquivo enviado
  const [papeis, setPapeis] = useState(cj.papeis);
  const [moveis, setMoveis] = useState<MovelParam[]>(cj.moveis);
  const [planta, setPlanta] = useState<PlantaMarcenaria | null>(cj.planta);
  const [plantaSel, setPlantaSel] = useState(cj.planta?.arquivo ?? plantas[0]?.caminho ?? "");
  const [r, setR] = useState<RespostasMarcenaria>(cj.respostas);
  const [lidos, setLidos] = useState<MovelLido[] | null>(null);
  const [recortes, setRecortes] = useState<Record<number, RecorteMarcenaria>>({});
  const [saida, setSaida] = useState<{ pdf: string | null; xlsx: string | null; verificacao: VerificacaoPrancha | null }>({ pdf: cj.pdf, xlsx: cj.xlsx, verificacao: cj.verificacao });
  const [erros, setErros] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [pendente, iniciar] = useTransition();
  const resp = (patch: Partial<RespostasMarcenaria>) => { setR((x) => ({ ...x, conferido: false, ...patch })); setMsg(""); };
  const mov = (i: number, patch: Partial<MovelParam>) => { setMoveis((l) => l.map((m, k) => (k === i ? { ...m, ...patch } : m))); setR((x) => ({ ...x, conferido: false })); };
  const modulo = (i: number, k: number, patch: Partial<ModuloParam>) => mov(i, { modulos: moveis[i].modulos.map((mo, j) => (j === k ? { ...mo, ...patch } : mo)) });
  const dados = () => ({ arquivo: arquivo || null, papeis, moveis, planta, respostas: r });

  const temPapel = (re: RegExp) => (lidos ?? []).some((m) => m.itens.some((it) => re.test(it.papel)));
  const temPorta = temPapel(/^porta$/) || moveis.some((m) => m.modulos.some((mo) => mo.tipo === "portas")), temGaveta = temPapel(/frente_gaveta/) || moveis.some((m) => m.modulos.some((mo) => mo.tipo === "gavetas"));
  const abertas = perguntasMarcenaria(r, (lidos ?? []).map((m) => ({ pecas: m.itens.map((it) => ({ papel: it.papel })) })) as never, moveis);
  const errosMoveis = moveis.flatMap((m) => errosDoMovelParam(m, espCaixaMm(r) ?? 18));
  const semMovel = !arquivo && moveis.length === 0;

  const ler = (pp = papeis) => iniciar(async () => {
    setErros([]); setMsg("");
    const x = await lerModeloMarcenaria(cj.id, arquivo, pp, r);
    if (!x.ok) { setErros(x.erros); setLidos(null); return; }
    setLidos(x.dados!); setMsg(`Li ${x.dados!.length} móvel(is) do SketchUp. Confira os desenhos e a lista de peças.`);
  });
  const trocarPapel = (chave: string, papel: Papel) => { const pp = { ...papeis, [chave]: papel }; setPapeis(pp); setR((x) => ({ ...x, conferido: false })); ler(pp); };
  const abrirPlanta = () => iniciar(async () => { setErros([]); const x = await prepararPlantaMarcenaria(cj.id, plantaSel); if (x.ok) { setPlanta(x.dados!); setMsg(x.dados!.observacao); } else setErros(x.erros); });
  const medir = (i: number) => iniciar(async () => { setErros([]); const x = await recortarAmbienteMarcenaria(cj.id, planta!.arquivo, moveis[i].ambiente); if (x.ok) setRecortes((o) => ({ ...o, [i]: x.dados! })); else setErros(x.erros); });
  const salvar = () => iniciar(async () => { const x = await salvarMarcenaria(cj.id, dados()); if (x.ok) { setMsg("Rascunho salvo."); setErros([]); } else setErros(x.erros); });
  const gerar = () => iniciar(async () => {
    setMsg(""); setErros([]);
    const x = await salvarEGerarMarcenaria(cj.id, dados());
    if (!x.ok) { setErros(x.erros); return; }
    setSaida({ pdf: x.dados!.pdf, xlsx: x.dados!.xlsx, verificacao: x.dados!.verificacao }); setMsg("Pranchas e planilha geradas.");
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">1. Móveis modelados no SketchUp</h2>
          <p className="text-sm text-cinza">É o caminho mais exato: as peças e medidas saem do próprio modelo, sem digitar. O arquivo .skp não é lido direto: o plugin gera um arquivo leve com as peças.</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li><a className="font-semibold text-azul underline" href="/plugin/MPA_exportar_marcenaria.rb" download>Baixe o plugin exportador</a> (uma vez só).</li>
            <li>No SketchUp: menu <b>Janela &gt; Console Ruby</b>, digite <code className="rounded bg-bege px-1">load &apos;caminho/MPA_exportar_marcenaria.rb&apos;</code> e Enter. Selecione o móvel (ou nada, para o modelo todo) e escolha <b>Extensões &gt; MPA: exportar marcenaria</b>.</li>
            <li>Envie aqui o arquivo que ele salvar (termina em <b>_marcenaria.json</b>).</li>
          </ol>
          <EnvioArquivo projetoId={projetoId} />
          {modelos.length > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block grow"><span className="rotulo">Arquivo do SketchUp</span>
                <select className="campo" value={arquivo} onChange={(e) => { setArquivo(e.target.value); setLidos(null); }}><option value="">Não usar SketchUp neste detalhamento</option>{modelos.map((a) => <option key={a.caminho} value={a.caminho}>{a.nome}</option>)}</select>
              </label>
              <button type="button" className="botao-ouro" disabled={pendente || !arquivo} onClick={() => ler()}>{pendente ? "Lendo…" : "Ler o modelo"}</button>
            </div>
          )}
          {lidos?.map((m) => (
            <div key={m.nome} className="rounded-xl border border-begelinha p-3">
              <div className="flex flex-wrap gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.previa && <img src={arq(m.previa) + `&t=${m.itens.length}`} alt={`Perspectiva do móvel ${m.nome}`} width={260} className="rounded-lg border border-begelinha" />}
                <div className="grow space-y-1">
                  <p className="font-semibold text-azul">{m.nome}</p>
                  <p className="text-sm">{m.L} x {m.P} x {m.A} mm <span className="text-cinza">(largura x profundidade x altura)</span></p>
                  {m.avisos.map((a) => <p key={a} className="adefinir block rounded-lg">{a}</p>)}
                </div>
              </div>
              <details className="mt-2" open={m.itens.some((it) => it.deduzido)}>
                <summary className="cursor-pointer text-sm font-semibold text-azul">Lista de peças ({m.itens.reduce((s, it) => s + it.qtd, 0)} peças). Corrija o tipo se estiver errado.</summary>
                <table className="mt-2 w-full text-left text-xs">
                  <thead><tr className="text-cinza"><th>Item</th><th>Peça</th><th>Qtd</th><th>C x L x E (mm)</th><th>Material</th><th>Tipo</th></tr></thead>
                  <tbody>{m.itens.map((it) => (
                    <tr key={it.item} className="border-t border-begelinha">
                      <td>{it.item}</td><td>{it.nome}</td><td>{it.qtd}</td><td>{it.C} x {it.L} x {it.E}</td><td>{it.material}</td>
                      <td><select className={"campo py-1 text-xs" + (it.deduzido ? " campo-vazio" : "")} aria-label={`Tipo do item ${it.item}`} value={it.papel} onChange={(e) => trocarPapel(it.chave, e.target.value as Papel)}>{PAPEIS.map((p) => <option key={p} value={p}>{NOME_PAPEL[p]}</option>)}</select></td>
                    </tr>
                  ))}</tbody>
                </table>
                <p className="mt-1 text-xs text-cinza">Campos em amarelo: o tipo foi deduzido pela posição da peça, porque o nome no SketchUp não diz o que ela é.</p>
              </details>
            </div>
          ))}
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">2. Móveis pela planta (sem SketchUp)</h2>
          <p className="text-sm text-cinza">Para móveis que só estão na planta baixa. O sistema lê os ambientes e a escala da planta; você marca o móvel com dois cliques e responde como ele é por dentro. As peças saem por regra e a prancha avisa que é <b>estimativa</b>.</p>
          {plantas.length > 0 ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block grow"><span className="rotulo">Planta</span><select className="campo" value={plantaSel} onChange={(e) => setPlantaSel(e.target.value)}>{plantas.map((a) => <option key={a.caminho} value={a.caminho}>{a.nome}</option>)}</select></label>
              <button type="button" className="botao-leve" disabled={pendente || !plantaSel} onClick={abrirPlanta}>{pendente ? "Lendo…" : "Ler a planta"}</button>
            </div>
          ) : <p className="adefinir">Nenhuma planta enviada neste projeto. Envie na aba Arquivos, ou digite as medidas dos móveis.</p>}
          {planta && <p className="text-xs text-cinza">{planta.observacao} Ambientes lidos: {planta.ambientes.join(", ")}.</p>}
          {moveis.map((m, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-begelinha p-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="block grow"><span className="rotulo">Nome do móvel</span><input className="campo" value={m.nome} onChange={(e) => mov(i, { nome: e.target.value })} /></label>
                <label className="block grow"><span className="rotulo">Ambiente</span><input className={"campo" + (m.ambiente ? "" : " campo-vazio")} list={`amb-${i}`} placeholder="a definir" value={m.ambiente} onChange={(e) => mov(i, { ambiente: e.target.value })} /><datalist id={`amb-${i}`}>{planta?.ambientes.map((a) => <option key={a} value={a} />)}</datalist></label>
                <button type="button" className="botao-leve text-vermelho" onClick={() => { setMoveis((l) => l.filter((_, k) => k !== i)); setRecortes({}); }}>Excluir móvel</button>
              </div>
              {planta?.temEscala && planta.ambientes.includes(m.ambiente) && <button type="button" className="botao-ouro" disabled={pendente} onClick={() => medir(i)}>{pendente ? "Abrindo…" : "Medir na planta (2 cliques)"}</button>}
              {recortes[i] && <MedirNaPlanta rec={recortes[i]} aoMedir={(L, P) => mov(i, { L, P })} />}
              <div className="grid gap-3 sm:grid-cols-3">
                <Mm rotulo="Largura" valor={m.L} aoMudar={(v) => mov(i, { L: v })} dica="ex.: 1800" /><Mm rotulo="Profundidade" valor={m.P} aoMudar={(v) => mov(i, { P: v })} dica="ex.: 550" /><Mm rotulo="Altura" valor={m.A} aoMudar={(v) => mov(i, { A: v })} dica="ex.: 850" />
              </div>
              <p className="text-xs text-cinza">A altura não aparece na planta baixa: use a legenda, a vista ou a medida combinada com o cliente.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Opcoes pergunta="Tem rodapé?" opcoes={["Sim", "Não"]} valor={m.rodape === "sim" ? "Sim" : m.rodape === "nao" ? "Não" : ""} aoEscolher={(v) => mov(i, { rodape: v === "Sim" ? "sim" : "nao" })} />
                <Opcoes pergunta="Tem fundo (chapa de 6 mm atrás)?" opcoes={["Sim", "Não"]} valor={m.fundo === "sim" ? "Sim" : m.fundo === "nao" ? "Não" : ""} aoEscolher={(v) => mov(i, { fundo: v === "Sim" ? "sim" : "nao" })} />
              </div>
              {m.rodape === "sim" && <div className="grid gap-3 sm:grid-cols-3"><Mm rotulo="Altura do rodapé" valor={m.rodapeAltura} aoMudar={(v) => mov(i, { rodapeAltura: v })} /><Mm rotulo="Recuo do rodapé" valor={m.rodapeRecuo} aoMudar={(v) => mov(i, { rodapeRecuo: v })} /></div>}
              <p className="text-sm font-semibold">Módulos, da esquerda para a direita (vistos de frente)</p>
              {m.modulos.map((mo, k) => (
                <div key={k} className="space-y-2 rounded-lg bg-offwhite p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Opcoes pergunta={`Módulo ${k + 1}`} opcoes={["Portas", "Gavetas", "Aberto (nicho)"]} valor={mo.tipo === "portas" ? "Portas" : mo.tipo === "gavetas" ? "Gavetas" : mo.tipo === "aberto" ? "Aberto (nicho)" : ""} aoEscolher={(v) => modulo(i, k, { tipo: v === "Portas" ? "portas" : v === "Gavetas" ? "gavetas" : "aberto", portas: 0, gavetas: 0 })} />
                    {m.modulos.length > 1 && <button type="button" className="text-xs font-semibold text-vermelho" onClick={() => mov(i, { modulos: m.modulos.filter((_, j) => j !== k) })}>Excluir módulo</button>}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {mo.tipo === "portas" && <Numero pergunta="Quantas portas?" valor={mo.portas} de={1} ate={2} aoEscolher={(n) => modulo(i, k, { portas: n })} />}
                    {mo.tipo === "gavetas" && <Numero pergunta="Quantas gavetas?" valor={mo.gavetas} de={1} ate={6} aoEscolher={(n) => modulo(i, k, { gavetas: n })} />}
                    {(mo.tipo === "portas" || mo.tipo === "aberto") && <Numero pergunta="Prateleiras internas" valor={mo.prateleiras} de={0} ate={6} aoEscolher={(n) => modulo(i, k, { prateleiras: n })} />}
                    <label className="block w-44"><span className="mb-1 block text-xs font-semibold text-cinza">Largura interna (mm)</span><input className="campo" inputMode="numeric" placeholder="vazio = divide igual" value={mo.largura ?? ""} onChange={(e) => modulo(i, k, { largura: inteiro(e.target.value) })} /></label>
                  </div>
                </div>
              ))}
              <button type="button" className="botao-leve" onClick={() => mov(i, { modulos: [...m.modulos, moduloNovo()] })}>+ Módulo</button>
              <div><p className="mb-1 text-xs font-semibold text-cinza">Como vai para a prancha (frente):</p><PreviaMovel m={m} r={r} /></div>
            </div>
          ))}
          <button type="button" className="botao" onClick={() => setMoveis((l) => [...l, movelParamNovo(l.length + 1)])}>+ Adicionar móvel por medidas</button>
        </section>

        <section className="cartao space-y-4">
          <h2 className="titulo text-sm">3. Perguntas antes de detalhar</h2>
          <Opcoes pergunta="Espessura do MDF da caixa" opcoes={ESPESSURAS} valor={r.espCaixa} aoEscolher={(v) => resp({ espCaixa: v })} />
          <label className="block"><span className="text-sm font-semibold">Acabamento (cor) do MDF da caixa {!r.acabamentoCaixa.trim() && <Falta />}</span><input className="campo mt-1" placeholder="ex.: MDF Branco TX" value={r.acabamentoCaixa} onChange={(e) => resp({ acabamentoCaixa: e.target.value })} /></label>
          {(temPorta || temGaveta) && <label className="block"><span className="text-sm font-semibold">Acabamento (cor) das portas e frentes {!r.acabamentoFrentes.trim() && <Falta />}</span><input className="campo mt-1" placeholder="ex.: MDF Freijó" value={r.acabamentoFrentes} onChange={(e) => resp({ acabamentoFrentes: e.target.value })} /></label>}
          <Opcoes pergunta="O acabamento tem desenho de madeira (veio)?" opcoes={["Sim", "Não"]} valor={r.veio === "sim" ? "Sim" : r.veio === "nao" ? "Não" : ""} aoEscolher={(v) => resp({ veio: v === "Sim" ? "sim" : "nao" })} />
          {(temPorta || temGaveta) && <Opcoes pergunta="Portas e frentes: sobrepostas ou embutidas?" opcoes={TIPOS_PORTA} valor={r.portas} aoEscolher={(v) => resp({ portas: v })} />}
          {(temPorta || temGaveta) && <Opcoes pergunta="Puxador" opcoes={PUXADORES} valor={r.puxador} aoEscolher={(v) => resp({ puxador: v })} outro />}
          {temGaveta && <Opcoes pergunta="Corrediça das gavetas" opcoes={CORREDICAS} valor={r.corredica} aoEscolher={(v) => resp({ corredica: v })} outro />}
          {temGaveta && moveis.some((m) => m.modulos.some((mo) => mo.tipo === "gavetas")) && <div className="w-64"><Mm rotulo="Altura das laterais das gavetas" valor={r.alturaLateralGaveta} aoMudar={(v) => resp({ alturaLateralGaveta: v })} /></div>}
          {temPorta && <Opcoes pergunta="Dobradiça" opcoes={DOBRADICAS} valor={r.dobradica} aoEscolher={(v) => resp({ dobradica: v })} outro />}
          {!temPorta && !temGaveta && <p className="text-xs text-cinza">As perguntas de puxador, dobradiça e corrediça aparecem quando houver portas ou gavetas (leia o modelo ou adicione um móvel).</p>}
        </section>

        <section className="cartao grid gap-3 sm:grid-cols-2">
          <h2 className="titulo text-sm sm:col-span-2">4. Carimbo</h2>
          <label className="block"><span className="rotulo">Cliente</span><input className="campo" value={r.cliente} onChange={(e) => resp({ cliente: e.target.value })} /></label>
          <label className="block"><span className="rotulo">Local da obra</span><input className="campo" value={r.local} onChange={(e) => resp({ local: e.target.value })} /></label>
          <label className="block"><span className="rotulo">Data</span><input type="date" className="campo" value={r.data} onChange={(e) => resp({ data: e.target.value })} /></label>
          <label className="block"><span className="rotulo">Revisão</span><input className="campo" inputMode="numeric" value={r.revisao} onChange={(e) => resp({ revisao: inteiro(e.target.value) ?? 0 })} /></label>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="cartao space-y-3 lg:sticky lg:top-4">
          <h2 className="titulo text-sm">Gerar</h2>
          {semMovel && <p className="adefinir block rounded-lg">Ainda não há móvel: envie o arquivo do SketchUp ou adicione um móvel por medidas.</p>}
          {abertas.length > 0 && <div className="aviso"><p className="font-semibold">Falta responder:</p><ul className="list-disc pl-4">{abertas.map((q) => <li key={q}>{q}</li>)}</ul></div>}
          {errosMoveis.map((e) => <p key={e} className="aviso">{e}</p>)}
          {!marcaDefinida && <p className="aviso">A marca da {sigla} está a definir. Cadastre em Empresas e marcas para gerar o documento.</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={r.conferido} onChange={(e) => setR((x) => ({ ...x, conferido: e.target.checked }))} /><span>Conferi os móveis, as medidas e a lista de peças.</span></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="botao-leve" disabled={pendente} onClick={salvar}>Salvar rascunho</button>
            <button type="button" className="botao-ouro grow" disabled={pendente || semMovel || abertas.length > 0 || errosMoveis.length > 0 || !r.conferido || !marcaDefinida} onClick={gerar}>{pendente ? "Trabalhando…" : "Gerar pranchas e planilha"}</button>
          </div>
          {msg && <p className="sucesso">{msg}</p>}
          {erros.length > 0 && <div className="aviso" role="alert"><ul className="list-disc pl-4">{erros.map((e) => <li key={e}>{e}</li>)}</ul></div>}
          {saida.pdf && (
            <div className="space-y-2 border-t border-begelinha pt-3">
              <a className="botao w-full" href={arq(saida.pdf)} target="_blank">Abrir as pranchas (PDF, {saida.verificacao?.folhas} folhas)</a>
              {saida.xlsx && <a className="botao-leve w-full" href={arq(saida.xlsx, false)}>Baixar a planilha (Excel)</a>}
              <p className="text-xs text-cinza">Conferência automática: {saida.verificacao?.sobreposicoes === 0 ? "nenhum texto ou cota sobreposto." : `${saida.verificacao?.sobreposicoes} sobreposição(ões): revise a prancha.`}</p>
              {saida.verificacao?.avisos.map((a) => <p key={a} className="adefinir block rounded-lg">{a}</p>)}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
