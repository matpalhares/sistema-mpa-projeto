// Regras de negócio usadas pelas ações e pelos testes (sem depender de cookies).
import { obter, salvar } from "./banco";
import { salvarArquivo, nomeSeguro } from "./arquivos";
import type { Detalhamento, Empresa, Memorial, Proposta, TipoMemorial } from "./tipos";
import { lerArquivo } from "./arquivos";
import { gerarPranchaMarmoraria } from "./pranchas/marmoraria";
import { errosBancada, perguntasEmAberto } from "./pranchas/regras-bancada";
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
