// Testes de aceite da Fase 1 (documentos). Rode com: npm run teste
// T07 proposta MPA · T08 memorial simplificado. O T10 (abas ocultas) está em testes/telas.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.MPA_PASTA_DADOS = fs.mkdtempSync(path.join(os.tmpdir(), "mpa-teste-"));

let falhas = 0;
const conferir = (nome: string, ok: boolean, detalhe = "") => { console.log(`${ok ? "  ✓" : "  ✕"} ${nome}${detalhe ? "  (" + detalhe + ")" : ""}`); if (!ok) falhas++; };

async function imagensPorPagina(pdf: Buffer): Promise<{ imagens: number[]; texto: string[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const imagens: number[] = [], texto: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    const ops = await pg.getOperatorList();
    imagens.push(ops.fnArray.filter((f: number) => f === pdfjs.OPS.paintImageXObject).length);
    texto.push((await pg.getTextContent()).items.map((x) => ("str" in x ? x.str : "")).join(" ").replace(/\s+/g, " "));
  }
  return { imagens, texto };
}

(async () => {
  const { salvar } = await import("../src/lib/banco");
  const { lerArquivo } = await import("../src/lib/arquivos");
  const { EMPRESAS_INICIAIS } = await import("../src/lib/marca");
  const { gerarProposta, gerarMemorial } = await import("../src/lib/servicos");
  const { propostaInicial } = await import("../src/lib/documentos/textos-proposta");
  const { errosProposta } = await import("../src/lib/documentos/regras-proposta");
  const { errosMemorial } = await import("../src/lib/documentos/regras-memorial");
  const { dadosTeste } = await import("./exemplo-memorial");
  const [mpa, lm] = EMPRESAS_INICIAIS;

  console.log("T07  Proposta MPA");
  const dados = propostaInicial({ perfil: "residencial", clienteNome: "Cliente de Teste", objetivo: "Projeto de interiores", tipoContratacao: "Projeto de interiores", escopo: [{ titulo: "Item A", descricao: "Descrição A" }, { titulo: "Item B — com travessão", descricao: "" }], valorTotal: 18500, validadeDias: 15 });
  dados.carta += "\n\nTexto com travessão — que deve sumir.";
  const pr = await salvar("propostas", { empresaId: "mpa", projetoId: null, versao: 1, status: "rascunho", dados, docx: null, pdf: null, verificacao: null } as never);
  const r = await gerarProposta(mpa, pr.id);
  conferir("gera DOCX e PDF", r.ok && !!r.dados?.docx && !!r.dados?.pdf);
  if (r.ok && r.dados?.pdf) {
    const v = r.dados.verificacao!;
    const pdf = (await lerArquivo(r.dados.pdf))!;
    const { imagens, texto } = await imagensPorPagina(pdf);
    conferir("sem páginas em branco", v.paginasEmBranco.length === 0, `${v.paginas} páginas`);
    conferir("sem travessão longo", !v.temTravessao && !/[—–]/.test(texto.join(" ")));
    conferir("logo na capa", imagens[0] >= 1, `${imagens[0]} imagem na página 1`);
    conferir("capa sem foto (só o logo)", imagens[0] === 1);
    conferir("6 páginas, como o modelo aprovado", v.paginas === 6, `${v.paginas} páginas`);
    conferir("seções do modelo presentes", ["PROPOSTA EXCLUSIVA", "Por que investir em um bom projeto", "O que está incluído no projeto", "Etapas do projeto", "Valor do projeto", "Aceite da proposta", "Minha Missão", "Próximos Passos"].every((x) => texto.join("").replace(/\s/g, "").includes(x.replace(/\s/g, ""))));
    conferir("QR codes no encerramento", imagens[imagens.length - 1] >= 3, `${imagens[imagens.length - 1]} imagens na última página`);
    conferir("pagamento padrão no texto", /5% de desconto/.test(texto.join(" ")) && /6x de R\$ 3\.083,33/.test(texto.join(" ")) && /Até 12x/.test(texto.join(" ")) && /com juros da operadora/.test(texto.join(" ")));
    conferir("à vista calculado (18.500 − 5% = 17.575,00)", /17\.575,00/.test(texto.join(" ")));
  }
  conferir("bloqueia fora de 4 a 6 etapas", errosProposta({ ...dados, etapas: dados.etapas.slice(0, 3) }).length > 0);
  conferir("bloqueia preço em 'Por que investir'", errosProposta({ ...dados, diferenciais: [{ titulo: "Barato", texto: "Custa R$ 100" }] }).length > 0);
  const prLm = await salvar("propostas", { empresaId: "lm", projetoId: null, versao: 1, status: "rascunho", dados, docx: null, pdf: null, verificacao: null } as never);
  conferir("empresa com marca a definir não gera documento", !(await gerarProposta(lm, prLm.id)).ok);
  conferir("isolamento: MPA não acessa proposta da LM", !(await gerarProposta(mpa, prLm.id)).ok);

  console.log("T08  Memorial simplificado");
  const me = await salvar("memoriais", { empresaId: "mpa", projetoId: "x", revisao: 0, dados: dadosTeste(), saidas: {} } as never);
  const m = await gerarMemorial(mpa, me.id, ["completo", "simplificado"]);
  conferir("gera os dois tipos", m.ok && !!m.dados?.saidas.completo && !!m.dados?.saidas.simplificado);
  if (m.ok && m.dados) {
    const simp = (await imagensPorPagina((await lerArquivo(m.dados.saidas.simplificado!.pdf!))!)).texto.join(" ");
    const comp = (await imagensPorPagina((await lerArquivo(m.dados.saidas.completo!.pdf!))!)).texto.join(" ");
    const proibidos = ["MarcaTesteXYZ", "ModeloTeste900", "TintaTesteQW", "90x90", "60x60", "São Gabriel", "1,50 m", "1,20 m"];
    conferir("simplificado sem marcas, modelos e medidas", proibidos.every((x) => !simp.includes(x)), proibidos.filter((x) => simp.includes(x)).join(", "));
    conferir("simplificado sem tabela de esquadrias", !simp.includes("Janela de correr") && simp.includes("quadro de esquadrias do projeto"));
    conferir("simplificado tem a frase de equivalência", simp.includes("padrão equivalente ou superior"));
    conferir("simplificado usa linguagem genérica", simp.includes("Porcelanato ou similar"));
    conferir("completo traz marcas, modelos e medidas", proibidos.slice(0, 6).every((x) => comp.includes(x)));
    conferir("campo vazio vira 'a definir'", simp.includes("a definir") && comp.includes("a definir"));
    conferir("área total calculada (40,50 + 80 + 20 = 140,50)", simp.includes("140,50"));
    conferir("sem páginas em branco", m.dados.saidas.simplificado!.verificacao.paginasEmBranco.length === 0 && m.dados.saidas.completo!.verificacao.paginasEmBranco.length === 0);
  }
  const comMedida = dadosTeste(); comMedida.ambientes[0].piso.tipo = "Porcelanato 90x90";
  conferir("bloqueia medida digitada no tipo (simplificado)", errosMemorial(comMedida, "simplificado").length > 0);
  conferir("bloqueia se a lista de ambientes não foi conferida", errosMemorial({ ...dadosTeste(), leituraConfirmada: false }, "completo").length > 0);

  console.log("T09  Marmoraria: perguntar antes de gerar");
  const { gerarMarmoraria } = await import("../src/lib/servicos");
  const { bancadaInicial, perguntasEmAberto, pecasBancada } = await import("../src/lib/pranchas/regras-bancada");
  const { CASOS } = await import("./exemplo-marmoraria");
  const novoDet = (dados: unknown) => salvar("detalhamentos", { empresaId: "mpa", projetoId: "x", tipo: "marmoraria", dados, plantaSituacao: null, pdf: null, verificacao: null } as never);
  const semRespostas = await novoDet(bancadaInicial({ ambiente: "BWC", comprimento: 1.2, profundidade: 0.5, lateralEsquerda: "parede", lateralDireita: "aberta", grapas: "A", revestimentosDefinidos: "nao", medidasConfirmadas: true }));
  const r9 = await gerarMarmoraria(mpa, semRespostas.id);
  const perguntas = r9.ok ? "" : r9.erros.join(" | ");
  conferir("sem pedra, cuba e torneira: não gera", !r9.ok);
  conferir("pergunta a pedra", perguntas.includes("Qual pedra será usada?"));
  conferir("pergunta o tipo de cuba", perguntas.includes("Qual o tipo de cuba?"));
  conferir("pergunta a torneira", perguntas.includes("Qual o tipo de torneira?"));
  conferir("com cuba escolhida, pergunta as medidas dela", perguntasEmAberto(bancadaInicial({ cubaTipo: "Esculpida" })).some((x) => x.includes("medidas da cuba")));
  conferir("pergunta os revestimentos", perguntasEmAberto(bancadaInicial()).some((x) => x.includes("revestimentos")));
  for (const [nome, dados] of Object.entries(CASOS)) {
    const dt = await novoDet(dados);
    const g = await gerarMarmoraria(mpa, dt.id);
    const v = g.ok ? g.dados!.verificacao! : null;
    conferir(`prancha "${nome}": 2 folhas, sem sobreposição de texto ou cota`, !!v && v.folhas === 2 && v.sobreposicoes === 0, v ? `${v.sobreposicoes} sobreposições` : (g.ok ? "" : g.erros.join("; ")));
    if (nome === "bwc" && g.ok) {
      const { texto } = await imagensPorPagina((await lerArquivo(g.dados!.pdf!))!);
      const t1 = texto.join(" ");
      conferir("padrões fixos na prancha (tampo 2 cm, frontão 2 x 10 cm, saia 20 cm)", t1.includes("Tampo 2 cm") && t1.includes("Frontão 2 x 10 cm") && t1.includes("Saia 20 cm"));
      conferir("cuba esculpida: fundo fixo e válvula click centralizada", /Fundo fixo, válvula click centralizada/.test(t1));
      conferir("grapas: metalon 40x30 mm ou barra Ø40 mm", t1.includes("metalon 40x30 mm ou barra Ø40 mm"));
      conferir("folhas numeradas sozinhas (01/02 e 02/02)", t1.includes("FOLHA 01/02") && t1.includes("FOLHA 02/02"));
      conferir("aviso de conferir medidas no local", t1.includes("CONFERIR MEDIDAS NO LOCAL"));
    }
  }
  const pb = pecasBancada(CASOS.bwc);
  conferir("lateral aberta: sem frontão lateral daquele lado, com saia lateral", pb.find((x) => x.nome === "Frontão lateral")?.qtd === 1 && pb.find((x) => x.nome === "Saia lateral")?.qtd === 1);
  conferir("bloqueia cuba que não cabe na bancada", !(await gerarMarmoraria(mpa, (await novoDet({ ...CASOS.bwc, cubaLargura: 1.3 })).id)).ok);
  conferir("bloqueia sem a conferência das medidas", !(await gerarMarmoraria(mpa, (await novoDet({ ...CASOS.bwc, medidasConfirmadas: false })).id)).ok);

  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exit(falhas ? 1 : 0);
})();
