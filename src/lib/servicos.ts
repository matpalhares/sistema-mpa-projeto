// Regras de negócio usadas pelas ações e pelos testes (sem depender de cookies).
import { obter, salvar } from "./banco";
import { salvarArquivo, nomeSeguro } from "./arquivos";
import type { ConjuntoMarcenaria, ConjuntoMolhadas, Detalhamento, Empresa, SaidaPrancha, Memorial, Proposta, TipoMemorial } from "./tipos";
import { lerArquivo } from "./arquivos";
import { gerarPranchaMarmoraria } from "./pranchas/marmoraria";
import { errosBancada, perguntasEmAberto } from "./pranchas/regras-bancada";
import { gerarExecutivo } from "./pranchas/executivo";
import { bancadaDoAmbiente, errosDoAmbiente, nbr, perguntasDoAmbiente } from "./pranchas/ambiente";
import { faltaNaMarca } from "./marca";
import { converterParaPdf, verificar } from "./documentos/comum";
import { errosProposta, gerarPropostaDocx } from "./documentos/proposta";
import { errosMemorial, gerarMemorialDocx } from "./documentos/memorial";

export type Resultado<T = undefined> = { ok: true; dados?: T } | { ok: false; erros: string[] };

function marcaPronta(empresa: Empresa): string[] {
  if (empresa.marca.definida) return [];
  return [`A marca da ${empresa.sigla} ainda está "a definir" (falta: ${faltaNaMarca(empresa.marca).join(", ")}). Cadastre em Empresas e marcas antes de gerar documentos dessa empresa.`];
}

export async function gerarProposta(empresa: Empresa, propostaId: string): Promise<Resultado<Proposta>> {
  const pr = await obter<Proposta>("propostas", propostaId, empresa.id);
  if (!pr) return { ok: false, erros: ["Proposta não encontrada."] };
  const erros = [...marcaPronta(empresa), ...errosProposta(pr.dados)];
  if (erros.length) return { ok: false, erros };
  const docx = await gerarPropostaDocx(empresa, pr.dados);
  const pdf = await converterParaPdf(docx);
  const verificacao = await verificar(pdf);
  const base = `${empresa.id}/propostas/${pr.id}/Proposta_${nomeSeguro(pr.dados.clienteNome || "cliente")}_v${pr.versao}`;
  await salvarArquivo(base + ".docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  if (pdf) await salvarArquivo(base + ".pdf", pdf, "application/pdf");
  const nova = await salvar<Proposta>("propostas", { ...pr, docx: base + ".docx", pdf: pdf ? base + ".pdf" : null, verificacao });
  return { ok: true, dados: nova };
}

export async function gerarMemorial(empresa: Empresa, memorialId: string, tipos: TipoMemorial[]): Promise<Resultado<Memorial>> {
  const me = await obter<Memorial>("memoriais", memorialId, empresa.id);
  if (!me) return { ok: false, erros: ["Memorial não encontrado."] };
  const erros = [...marcaPronta(empresa), ...tipos.flatMap((t) => errosMemorial(me.dados, t))];
  if (erros.length) return { ok: false, erros: [...new Set(erros)] };
  const saidas = { ...me.saidas };
  for (const tipo of tipos) {
    const docx = await gerarMemorialDocx(empresa, me.dados, tipo);
    const pdf = await converterParaPdf(docx);
    const verificacao = await verificar(pdf);
    const rev = "R" + String(me.revisao).padStart(2, "0");
    const nome = tipo === "completo" ? `Memorial_Descritivo_${nomeSeguro(me.dados.obra || "obra")}_${rev}` : `Memorial_Simplificado_Prefeitura_${nomeSeguro(me.dados.obra || "obra")}_${rev}`;
    const base = `${empresa.id}/memoriais/${me.id}/${nome}`;
    await salvarArquivo(base + ".docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    if (pdf) await salvarArquivo(base + ".pdf", pdf, "application/pdf");
    saidas[tipo] = { docx: base + ".docx", pdf: pdf ? base + ".pdf" : null, verificacao };
  }
  const novo = await salvar<Memorial>("memoriais", { ...me, saidas });
  return { ok: true, dados: novo };
}

// Marmoraria (P05, padrão A). Teste T09: enquanto houver pergunta obrigatória sem resposta, não gera.
export async function gerarMarmoraria(empresa: Empresa, id: string): Promise<Resultado<Detalhamento>> {
  const det = await obter<Detalhamento>("detalhamentos", id, empresa.id);
  if (!det) return { ok: false, erros: ["Detalhamento não encontrado."] };
  const abertas = perguntasEmAberto(det.dados);
  if (abertas.length) return { ok: false, erros: abertas.map((p) => "Responda antes de gerar: " + p) };
  const erros = [...marcaPronta(empresa), ...errosBancada(det.dados)];
  if (erros.length) return { ok: false, erros };
  const situacao = det.plantaSituacao && /\.(png|jpe?g)$/i.test(det.plantaSituacao) ? await lerArquivo(det.plantaSituacao) : null;
  const r = await gerarPranchaMarmoraria(empresa, det.dados, situacao);
  const caminho = `${empresa.id}/detalhamentos/${det.id}/Marmoraria_${nomeSeguro(det.dados.nomePrancha || det.dados.ambiente)}_R${String(det.dados.revisao).padStart(2, "0")}.pdf`;
  await salvarArquivo(caminho, r.pdf, "application/pdf");
  const novo = await salvar<Detalhamento>("detalhamentos", { ...det, pdf: caminho, verificacao: { folhas: r.folhas, sobreposicoes: r.sobreposicoes.length, avisos: r.avisos } });
  return { ok: true, dados: novo };
}

// Áreas molhadas a partir da planta: executivo A3 de cada ambiente + prancha de marmoraria de cada bancada.
// Enquanto houver pergunta obrigatória sem resposta, nada é gerado (teste T09).
export async function gerarConjuntoMolhadas(empresa: Empresa, id: string): Promise<Resultado<ConjuntoMolhadas>> {
  const cj = await obter<ConjuntoMolhadas>("molhadas", id, empresa.id);
  if (!cj) return { ok: false, erros: ["Conjunto não encontrado."] };
  if (cj.ambientes.length === 0) return { ok: false, erros: ["Nenhum ambiente ainda. Leia a planta ou adicione um ambiente."] };
  const abertas = [...new Set(cj.ambientes.flatMap((a) => perguntasDoAmbiente(a, cj.respostas)))];
  if (abertas.length) return { ok: false, erros: abertas.map((p) => "Responda antes de gerar: " + p) };
  const erros = [...marcaPronta(empresa), ...new Set(cj.ambientes.flatMap((a) => errosDoAmbiente(a, cj.respostas)))];
  if (erros.length) return { ok: false, erros };
  const saidas: SaidaPrancha[] = [], avisos: string[] = [];
  const total = cj.ambientes.length * 2, pasta = `${empresa.id}/molhadas/${cj.id}`, rev = "R" + String(cj.respostas.revisao).padStart(2, "0");
  for (const [i, a] of cj.ambientes.entries()) {
    const ex = await gerarExecutivo(empresa, a, cj.respostas, { folhaInicial: i * 2 + 1, totalFolhas: total, parametros: nbr(cj.parametros) });
    const caminho = `${pasta}/Executivo_${nomeSeguro(a.nome)}_${rev}.pdf`;
    await salvarArquivo(caminho, ex.pdf, "application/pdf");
    saidas.push({ nome: `${a.nome}: executivo (folhas ${String(i * 2 + 1).padStart(2, "0")} e ${String(i * 2 + 2).padStart(2, "0")} de ${String(total).padStart(2, "0")})`, tipo: "executivo", pdf: caminho, folhas: ex.folhas, sobreposicoes: ex.sobreposicoes.length });
    avisos.push(...ex.avisos);
    for (const [k, b] of a.bancadas.entries()) {
      const dados = bancadaDoAmbiente(a, k, cj.respostas);
      const ma = await gerarPranchaMarmoraria(empresa, dados);
      const cm = `${pasta}/Marmoraria_${nomeSeguro(dados.nomePrancha)}_${rev}.pdf`;
      await salvarArquivo(cm, ma.pdf, "application/pdf");
      saidas.push({ nome: `${dados.nomePrancha}: marmoraria`, tipo: "marmoraria", pdf: cm, folhas: ma.folhas, sobreposicoes: ma.sobreposicoes.length });
      avisos.push(...ma.avisos);
      if (b.cubas.length > 1) avisos.push(`${dados.nomePrancha}: a bancada tem ${b.cubas.length} cubas; a prancha de marmoraria mostra só a primeira. As demais estão no executivo.`);
    }
  }
  const novo = await salvar<ConjuntoMolhadas>("molhadas", { ...cj, saidas, avisos: [...new Set(avisos)] });
  return { ok: true, dados: novo };
}

// Marcenaria: junta os móveis do SketchUp e os móveis por medidas. Enquanto houver pergunta sem resposta, não gera.
import { avisosMarcenaria, errosDoMovelParam, espCaixaMm, ferragens, moveisDoModelo, movelPorMedidas, perguntasMarcenaria, validarModelo, type Movel } from "./marcenaria/modelo";
import { gerarPranchasMarcenaria } from "./pranchas/marcenaria";
import { planilhaMarcenaria } from "./marcenaria/planilha";

export async function moveisDoArquivo(cj: Pick<ConjuntoMarcenaria, "arquivo" | "papeis">): Promise<{ moveis: Movel[]; erro?: string }> {
  if (!cj.arquivo) return { moveis: [] };
  const buf = await lerArquivo(cj.arquivo);
  if (!buf) return { moveis: [], erro: "Não consegui abrir o arquivo do SketchUp." };
  let j: unknown; try { j = JSON.parse(buf.toString("utf8").replace(/^\uFEFF/, "")); } catch { return { moveis: [], erro: "O arquivo não é um JSON válido. Envie o arquivo gerado pelo plugin MPA no SketchUp (termina em _marcenaria.json)." }; }
  const v = validarModelo(j);
  if (!v.ok) return { moveis: [], erro: v.erro };
  return { moveis: moveisDoModelo(v.modelo, cj.papeis).filter((m) => m.pecas.length) };
}

export async function gerarMarcenaria(empresa: Empresa, id: string): Promise<Resultado<ConjuntoMarcenaria>> {
  const cj = await obter<ConjuntoMarcenaria>("marcenarias", id, empresa.id);
  if (!cj) return { ok: false, erros: ["Marcenaria não encontrada."] };
  const lido = await moveisDoArquivo(cj);
  if (lido.erro) return { ok: false, erros: [lido.erro] };
  if (lido.moveis.length + cj.moveis.length === 0) return { ok: false, erros: ["Nenhum móvel ainda. Envie o arquivo do SketchUp ou adicione um móvel por medidas."] };
  const abertas = perguntasMarcenaria(cj.respostas, lido.moveis, cj.moveis);
  if (abertas.length) return { ok: false, erros: abertas.map((p) => "Responda antes de gerar: " + p) };
  const erros = [...marcaPronta(empresa), ...cj.moveis.flatMap((m) => errosDoMovelParam(m, espCaixaMm(cj.respostas) ?? 18))];
  if (!cj.respostas.conferido) erros.push("Confira os móveis e a lista de peças e marque a caixa de conferência antes de gerar.");
  if (erros.length) return { ok: false, erros };
  const moveis = [...lido.moveis, ...cj.moveis.map((m) => movelPorMedidas(m, cj.respostas))];
  const r = await gerarPranchasMarcenaria(empresa, moveis, cj.respostas);
  const base = `${empresa.id}/marcenarias/${cj.id}/Marcenaria_${nomeSeguro(cj.respostas.cliente || "cliente")}_R${String(cj.respostas.revisao).padStart(2, "0")}`;
  await salvarArquivo(base + ".pdf", r.pdf, "application/pdf");
  await salvarArquivo(base + ".xlsx", await planilhaMarcenaria(r.itens, ferragens(moveis, cj.respostas), r.chapas), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const novo = await salvar<ConjuntoMarcenaria>("marcenarias", { ...cj, pdf: base + ".pdf", xlsx: base + ".xlsx", verificacao: { folhas: r.folhas, sobreposicoes: r.sobreposicoes.length, avisos: [...new Set([...avisosMarcenaria(moveis, cj.respostas), ...r.avisos])] } });
  return { ok: true, dados: novo };
}
