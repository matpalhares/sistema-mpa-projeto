"use client";
import { useState, useTransition } from "react";
import { lerPlantaDoProjeto, salvarEGerarMemorial, salvarMemorial } from "@/app/acoes";
import { contemMedida, OPCOES_ACABAMENTO, PERGUNTAS_SERVICOS, SECOES_SERVICOS, TIPOS_OBRA } from "@/lib/documentos/opcoes-memorial";
import { acabamentoVazio, areaTotal, errosMemorial, pendenciasMemorial } from "@/lib/documentos/regras-memorial";
import type { Acabamento, AmbienteMemorial, ArquivoRef, DadosMemorial, Memorial, TipoMemorial } from "@/lib/tipos";
import { Calculo } from "./ui";

const paraNumero = (v: string): number | null => { if (!v.trim()) return null; const n = Number(v.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const deNumero = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
const vazio = (v: string | number | null) => (v == null || v === "" ? " campo-vazio" : "");
type Escolha = "completo" | "simplificado" | "os dois" | "";

function Texto({ rotulo, valor, aoMudar, dica }: { rotulo: string; valor: string; aoMudar: (v: string) => void; dica?: string }) {
  return <label className="block"><span className="rotulo">{rotulo}</span><input className={"campo" + vazio(valor)} value={valor} placeholder={dica ?? "a definir"} onChange={(e) => aoMudar(e.target.value)} /></label>;
}
function Area({ rotulo, valor, aoMudar }: { rotulo: string; valor: number | null; aoMudar: (v: number | null) => void }) {
  const [t, setT] = useState(deNumero(valor));
  return <label className="block"><span className="rotulo">{rotulo} (m²)</span><input className={"campo" + vazio(valor)} inputMode="decimal" placeholder="a definir" value={t} onChange={(e) => { setT(e.target.value); aoMudar(paraNumero(e.target.value)); }} /></label>;
}
function CampoAcabamento({ rotulo, a, opcoes, completo, aoMudar, id }: { rotulo: string; a: Acabamento; opcoes: string[]; completo: boolean; aoMudar: (a: Acabamento) => void; id: string }) {
  const comMedida = contemMedida(a.tipo);
  return (
    <div className="rounded-xl bg-bege/40 p-2">
      <span className="rotulo">{rotulo}</span>
      <input className={"campo" + vazio(a.tipo)} list={id} value={a.tipo} placeholder="Tipo: a definir" aria-label={`${rotulo}: tipo`} onChange={(e) => aoMudar({ ...a, tipo: e.target.value })} />
      <datalist id={id}>{opcoes.map((o) => <option key={o} value={o} />)}</datalist>
      {comMedida && <p className="mt-1 text-xs text-vermelho">Tire a medida daqui e use o campo Medida: no memorial da prefeitura medidas não podem aparecer.</p>}
      {completo && (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {(["marca", "modelo", "medida"] as const).map((k) => <input key={k} className="campo px-2 py-1 text-xs" value={a[k]} placeholder={k[0].toUpperCase() + k.slice(1)} aria-label={`${rotulo}: ${k}`} onChange={(e) => aoMudar({ ...a, [k]: e.target.value })} />)}
        </div>
      )}
    </div>
  );
}

export function EditorMemorial({ memorial, plantas, iaLigada, marcaDefinida, sigla }: { memorial: Memorial; plantas: ArquivoRef[]; iaLigada: boolean; marcaDefinida: boolean; sigla: string }) {
  const [d, setD] = useState<DadosMemorial>(memorial.dados);
  const jaGerados = Object.keys(memorial.saidas) as TipoMemorial[];
  const [escolha, setEscolha] = useState<Escolha>(jaGerados.length === 2 ? "os dois" : jaGerados[0] ?? "");
  const [saidas, setSaidas] = useState(memorial.saidas);
  const [erros, setErros] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [leitura, setLeitura] = useState("");
  const [planta, setPlanta] = useState(plantas[0]?.caminho ?? "");
  const [sujo, setSujo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const mudar = (patch: Partial<DadosMemorial>) => { setD((x) => ({ ...x, ...patch })); setSujo(true); setMsg(""); };
  const tipos: TipoMemorial[] = escolha === "os dois" ? ["completo", "simplificado"] : escolha ? [escolha] : [];
  const completo = tipos.includes("completo");
  const falta = pendenciasMemorial(d, completo ? "completo" : "simplificado");
  const bloqueios = [...new Set([
    ...(escolha ? [] : ["Escolha o tipo de memorial (passo 1)."]),
    ...tipos.flatMap((t) => errosMemorial(d, t)),
    ...(marcaDefinida ? [] : [`A marca da ${sigla} está a definir. Cadastre em Empresas e marcas para gerar o documento.`]),
  ])];
  const total = areaTotal(d);
  const mudarAmb = (i: number, patch: Partial<AmbienteMemorial>) => mudar({ ambientes: d.ambientes.map((a, k) => (k === i ? { ...a, ...patch } : a)), leituraConfirmada: false });
  const novoAmb = (nome = "", areaM2: number | null = null): AmbienteMemorial => ({ nome, areaM2, piso: acabamentoVazio(), paredes: acabamentoVazio(), teto: acabamentoVazio(), esquadrias: "" });

  const ler = () => iniciar(async () => {
    setLeitura(""); setErros([]);
    const r = await lerPlantaDoProjeto(memorial.projetoId, planta);
    if (!r.ok) { setErros(r.erros); return; }
    const existentes = new Set(d.ambientes.map((a) => a.nome.trim().toLowerCase()));
    const novos = r.dados!.ambientes.filter((a) => !existentes.has(a.nome.trim().toLowerCase())).map((a) => novoAmb(a.nome, a.areaM2));
    mudar({ ambientes: [...d.ambientes, ...novos], leituraConfirmada: false });
    setLeitura(`Li ${r.dados!.ambientes.length} ambiente(s) na planta e adicionei ${novos.length}. ${r.dados!.observacoes} Confira a lista: a leitura é aproximada.`);
  });
  const salvar = () => iniciar(async () => { const r = await salvarMemorial(memorial.id, d); if (r.ok) { setSujo(false); setMsg("Rascunho salvo."); setErros([]); } else setErros(r.erros); });
  const gerar = () => iniciar(async () => {
    setMsg(""); setErros([]);
    const r = await salvarEGerarMemorial(memorial.id, d, tipos);
    if (!r.ok) { setErros(r.erros); return; }
    setSujo(false); setSaidas(r.dados!.saidas); setMsg("Memorial gerado.");
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="cartao">
          <h2 className="titulo mb-2 text-sm">1. Tipo de memorial</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {([["os dois", "Os dois (Recomendado)", "Você preenche uma vez e saem os dois arquivos."], ["completo", "Completo", "Para o cliente e a obra: materiais, marcas, modelos e medidas."], ["simplificado", "Simplificado", "Para a prefeitura: sem marcas, modelos e medidas."]] as const).map(([v, t, s]) => (
              <button type="button" key={v} className={"opcao " + (escolha === v ? "opcao-ativa" : "")} onClick={() => setEscolha(v)}><strong className="block">{t}</strong><span className="text-xs opacity-80">{s}</span></button>
            ))}
          </div>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">2. Identificação</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Texto rotulo="Proprietário" valor={d.proprietario} aoMudar={(v) => mudar({ proprietario: v })} />
            <Texto rotulo="CPF ou CNPJ" valor={d.cpfCnpj} aoMudar={(v) => mudar({ cpfCnpj: v })} />
            <Texto rotulo="Obra" valor={d.obra} aoMudar={(v) => mudar({ obra: v })} />
            <label className="block"><span className="rotulo">Tipo de obra</span>
              <select className={"campo" + vazio(d.tipoObra)} value={d.tipoObra} onChange={(e) => mudar({ tipoObra: e.target.value })}><option value="">a definir</option>{TIPOS_OBRA.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <Texto rotulo="Endereço" valor={d.endereco} aoMudar={(v) => mudar({ endereco: v })} />
            <Texto rotulo="Município" valor={d.municipio} aoMudar={(v) => mudar({ municipio: v })} />
            <Texto rotulo="Matrícula do imóvel" valor={d.matricula} aoMudar={(v) => mudar({ matricula: v })} />
            <Texto rotulo="Inscrição municipal" valor={d.inscricaoMunicipal} aoMudar={(v) => mudar({ inscricaoMunicipal: v })} />
            <Texto rotulo="Número do RRT" valor={d.rrt} aoMudar={(v) => mudar({ rrt: v })} />
            <label className="block"><span className="rotulo">Data do documento</span><input type="date" className="campo" value={d.data} onChange={(e) => mudar({ data: e.target.value })} /></label>
          </div>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">3. Quadro de áreas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Area rotulo="Área do terreno" valor={d.areaTerreno} aoMudar={(v) => mudar({ areaTerreno: v })} />
            <Area rotulo="Área a construir" valor={d.areaAConstruir} aoMudar={(v) => mudar({ areaAConstruir: v })} />
            <Area rotulo="Área existente a reformar" valor={d.areaExistenteReformada} aoMudar={(v) => mudar({ areaExistenteReformada: v })} />
            <Area rotulo="Área existente mantida" valor={d.areaExistenteMantida} aoMudar={(v) => mudar({ areaExistenteMantida: v })} />
          </div>
          <p className="text-xs text-cinza">Se uma área não existe na obra, digite 0. Vazio significa &quot;a definir&quot;.</p>
          <div className="rounded-xl bg-[#F2F2F2] p-3 text-sm">Área total edificada: <strong>{total != null ? total.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + " m²" : <span className="adefinir">a definir</span>}</strong>
            <Calculo>{total != null ? `${deNumero(d.areaAConstruir)} (a construir) + ${deNumero(d.areaExistenteReformada)} (a reformar) + ${deNumero(d.areaExistenteMantida)} (mantida) = ${deNumero(total)} m².` : "Soma de: a construir + existente a reformar + existente mantida. Só é calculada quando as três estão preenchidas."}</Calculo>
          </div>
          <p className="text-xs text-cinza">Índices urbanísticos: copie do projeto legal ou da prefeitura. O sistema não calcula nem inventa esses índices.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Texto rotulo="Taxa de ocupação" valor={d.taxaOcupacao} aoMudar={(v) => mudar({ taxaOcupacao: v })} />
            <Texto rotulo="Coef. de aproveitamento" valor={d.coeficienteAproveitamento} aoMudar={(v) => mudar({ coeficienteAproveitamento: v })} />
            <Texto rotulo="Taxa de permeabilidade" valor={d.taxaPermeabilidade} aoMudar={(v) => mudar({ taxaPermeabilidade: v })} />
          </div>
          <label className="block"><span className="rotulo">Ajuste por município (opcional)</span>
            <textarea className="campo" value={d.ajusteMunicipio} placeholder="Texto exigido pela prefeitura deste município, se houver. Entra na seção 3 do memorial." onChange={(e) => mudar({ ajusteMunicipio: e.target.value })} />
          </label>
        </section>

        <section className="cartao space-y-3">
          <h2 className="titulo text-sm">4. Ambientes e acabamentos</h2>
          <div className="rounded-xl bg-[#DDEBF7] p-3 text-sm">
            <p className="mb-2 font-semibold text-azul">Ler os ambientes da planta (opcional)</p>
            {plantas.length === 0 ? <p className="text-xs">Nenhuma planta enviada neste projeto. Envie na aba Arquivos do projeto, ou adicione os ambientes à mão abaixo.</p> : (
              <div className="flex flex-wrap items-center gap-2">
                <select className="campo w-auto grow" value={planta} onChange={(e) => setPlanta(e.target.value)} aria-label="Planta">{plantas.map((p) => <option key={p.caminho} value={p.caminho}>{p.nome}</option>)}</select>
                <button type="button" className="botao" onClick={ler} disabled={pendente}>{pendente ? "Lendo..." : "Ler planta"}</button>
              </div>
            )}
            {!iaLigada && plantas.length > 0 && <p className="mt-2 text-xs">Sem a chave da API do Claude, a leitura funciona com PDF exportado direto do programa de desenho. Foto ou imagem da planta: adicione os ambientes à mão.</p>}
            {leitura && <p className="mt-2 text-xs">{leitura}</p>}
          </div>
          {d.ambientes.map((a, i) => (
            <div key={i} className="rounded-xl border border-begelinha p-3">
              <div className="mb-2 flex gap-2">
                <input className={"campo font-semibold" + vazio(a.nome)} value={a.nome} placeholder="Nome do ambiente" aria-label={`Nome do ambiente ${i + 1}`} onChange={(e) => mudarAmb(i, { nome: e.target.value })} />
                {completo && <input className="campo w-28" inputMode="decimal" defaultValue={deNumero(a.areaM2)} placeholder="m²" aria-label={`Área do ambiente ${i + 1}`} onChange={(e) => mudarAmb(i, { areaM2: paraNumero(e.target.value) })} />}
                <button type="button" className="botao-leve" onClick={() => mudar({ ambientes: d.ambientes.filter((_, k) => k !== i), leituraConfirmada: false })} aria-label="Remover ambiente">✕</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <CampoAcabamento id={`piso-${i}`} rotulo="Piso" a={a.piso} opcoes={OPCOES_ACABAMENTO.piso} completo={completo} aoMudar={(x) => mudarAmb(i, { piso: x })} />
                <CampoAcabamento id={`par-${i}`} rotulo="Paredes" a={a.paredes} opcoes={OPCOES_ACABAMENTO.paredes} completo={completo} aoMudar={(x) => mudarAmb(i, { paredes: x })} />
                <CampoAcabamento id={`teto-${i}`} rotulo="Teto" a={a.teto} opcoes={OPCOES_ACABAMENTO.teto} completo={completo} aoMudar={(x) => mudarAmb(i, { teto: x })} />
              </div>
              {completo && <input className="campo mt-2" value={a.esquadrias} placeholder="Esquadrias deste ambiente (ex.: P1, J2): só no completo" aria-label={`Esquadrias do ambiente ${i + 1}`} onChange={(e) => mudarAmb(i, { esquadrias: e.target.value })} />}
            </div>
          ))}
          <button type="button" className="botao-leve" onClick={() => mudar({ ambientes: [...d.ambientes, novoAmb()], leituraConfirmada: false })}>+ Adicionar ambiente</button>
          <label className={"flex cursor-pointer items-center gap-2 rounded-xl p-3 text-sm font-semibold " + (d.leituraConfirmada ? "bg-verde/10 text-verde" : "bg-adefinir text-adefinir-texto")}>
            <input type="checkbox" checked={d.leituraConfirmada} disabled={d.ambientes.length === 0} onChange={(e) => { setD((x) => ({ ...x, leituraConfirmada: e.target.checked })); setSujo(true); }} />
            Conferi a lista de ambientes e ela está de acordo com a planta
          </label>
        </section>

        <section className="cartao space-y-4">
          <h2 className="titulo text-sm">5. Descrição dos serviços</h2>
          <p className="text-xs text-cinza">Clique na opção que vale para esta obra. Se não souber agora, deixe sem resposta: sai &quot;a definir&quot; em amarelo.</p>
          {SECOES_SERVICOS.map((s) => (
            <div key={s.id} className="space-y-3">
              <h3 className="border-b border-begelinha pb-1 text-sm font-semibold text-azul">{s.id} {s.titulo}</h3>
              {PERGUNTAS_SERVICOS.filter((q) => q.secao === s.id).map((q) => {
                const r = d.servicos[q.chave] ?? { resposta: "", detalhe: "" };
                const def = (patch: Partial<typeof r>) => mudar({ servicos: { ...d.servicos, [q.chave]: { ...r, ...patch } } });
                const outro = r.resposta !== "" && !q.opcoes.includes(r.resposta);
                return (
                  <div key={q.chave}>
                    <p className="mb-1 text-sm font-semibold">{q.pergunta} {!r.resposta && <span className="adefinir ml-1">a definir</span>}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.opcoes.map((o) => <button type="button" key={o} className={"opcao " + (r.resposta === o ? "opcao-ativa" : "")} onClick={() => def({ resposta: r.resposta === o ? "" : o })}>{o}</button>)}
                      <input className={"campo w-64" + (outro ? " border-azul" : "")} placeholder="Outro: escreva aqui" value={outro ? r.resposta : ""} aria-label={`${q.rotulo}: outra resposta`} onChange={(e) => def({ resposta: e.target.value })} />
                    </div>
                    {contemMedida(r.resposta) && <p className="mt-1 text-xs text-vermelho">Há medida na resposta. Passe para o campo de detalhe: no memorial da prefeitura medidas não podem aparecer.</p>}
                    {completo && q.dicaDetalhe && <input className="campo mt-2" value={r.detalhe} placeholder={`Detalhe só do completo (marcas, modelos, medidas). ${q.dicaDetalhe}`} aria-label={`${q.rotulo}: detalhe`} onChange={(e) => def({ detalhe: e.target.value })} />}
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        {completo && (
          <section className="cartao space-y-2">
            <h2 className="titulo text-sm">6. Tabela de esquadrias (só no completo)</h2>
            <p className="text-xs text-cinza">No simplificado esta tabela não aparece: o texto remete ao quadro de esquadrias do projeto arquitetônico.</p>
            {d.esquadrias.map((e, i) => (
              <div key={i} className="grid grid-cols-3 gap-1 sm:grid-cols-[4rem_1fr_1fr_5rem_5rem_4rem_auto]">
                {(["codigo", "tipo", "material", "largura", "altura", "quantidade"] as const).map((k) => (
                  <input key={k} className="campo px-2" value={e[k]} placeholder={{ codigo: "Cód.", tipo: "Tipo", material: "Material", largura: "Largura", altura: "Altura", quantidade: "Qtd." }[k]} aria-label={`Esquadria ${i + 1}: ${k}`} onChange={(ev) => mudar({ esquadrias: d.esquadrias.map((x, n) => (n === i ? { ...x, [k]: ev.target.value } : x)) })} />
                ))}
                <button type="button" className="botao-leve" onClick={() => mudar({ esquadrias: d.esquadrias.filter((_, n) => n !== i) })} aria-label="Remover esquadria">✕</button>
              </div>
            ))}
            <button type="button" className="botao-leve" onClick={() => mudar({ esquadrias: [...d.esquadrias, { codigo: "", tipo: "", material: "", largura: "", altura: "", quantidade: "" }] })}>+ Adicionar esquadria</button>
          </section>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="cartao space-y-3">
          <h2 className="titulo text-sm">Gerar</h2>
          <button className="botao-ouro w-full" onClick={gerar} disabled={pendente || bloqueios.length > 0}>{pendente ? "Gerando..." : "Gerar memorial (DOCX + PDF)"}</button>
          <button className="botao-leve w-full" onClick={salvar} disabled={pendente || !sujo}>Salvar rascunho</button>
          {bloqueios.map((b, i) => <p key={i} className="aviso">{b}</p>)}
          {erros.map((b, i) => <p key={"e" + i} className="aviso" role="alert">{b}</p>)}
          {msg && <p className="sucesso" role="status">{msg}</p>}
          {(["completo", "simplificado"] as const).map((t) => saidas[t] && (
            <div key={t} className="space-y-1 border-t border-begelinha pt-3">
              <p className="text-xs font-semibold uppercase text-cinza">{t === "completo" ? "Completo (cliente e obra)" : "Simplificado (prefeitura)"}</p>
              <div className="flex gap-2">
                {saidas[t]!.pdf && <a className="botao grow" href={`/api/arquivo?c=${encodeURIComponent(saidas[t]!.pdf!)}&ver=1`} target="_blank">Abrir PDF</a>}
                <a className="botao-leve grow" href={`/api/arquivo?c=${encodeURIComponent(saidas[t]!.docx)}`}>Baixar DOCX</a>
              </div>
              <ul className="text-xs text-cinza">
                <li>{saidas[t]!.verificacao.pdfGerado ? `✓ PDF com ${saidas[t]!.verificacao.paginas} páginas, ${saidas[t]!.verificacao.paginasEmBranco.length ? "com página em branco" : "sem páginas em branco"}` : "PDF não gerado"}</li>
                {saidas[t]!.verificacao.avisos.map((a, i) => <li key={i} className="text-vermelho">{a}</li>)}
              </ul>
            </div>
          ))}
          {sujo && Object.keys(saidas).length > 0 && <p className="text-xs text-adefinir-texto">Você mudou dados depois de gerar. Gere de novo para atualizar os arquivos.</p>}
          <p className="text-xs text-cinza">Cada prefeitura pode ter modelo próprio: confira com a do município antes de protocolar.</p>
        </div>
        <div className="cartao">
          <h2 className="titulo mb-2 text-sm">Falta preencher ({falta.length})</h2>
          {falta.length === 0 ? <p className="text-sm text-verde">Tudo preenchido.</p> : (
            <>
              <ul className="max-h-72 space-y-1 overflow-auto text-sm">{falta.map((x) => <li key={x} className="rounded-lg bg-adefinir/60 px-3 py-1.5">{x}</li>)}</ul>
              <p className="mt-2 text-xs text-cinza">Você pode gerar mesmo assim: o que falta sai como &quot;a definir&quot; em amarelo.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
