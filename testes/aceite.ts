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

  console.log("Áreas molhadas a partir da planta (executivo A3 + marmoraria)");
  const { gerarConjuntoMolhadas } = await import("../src/lib/servicos");
  const { EXEMPLOS, NBR9050_PADRAO, barrasDoAmbiente, nbr, respostasIniciais, bancadaDoAmbiente } = await import("../src/lib/pranchas/ambiente");
  const { RESP } = await import("./exemplo-executivo");
  const novoCj = (ambientes: unknown[], respostas: unknown) => salvar("molhadas", { empresaId: "mpa", projetoId: "x", planta: null, ambientes, respostas, parametros: NBR9050_PADRAO, saidas: [], avisos: [] } as never);
  const semResp = await gerarConjuntoMolhadas(mpa, (await novoCj([{ ...EXEMPLOS.bwc2pne, acessivel: "" }], respostasIniciais({ modeloConferido: true }))).id);
  const pq = semResp.ok ? "" : semResp.erros.join(" | ");
  conferir("T09: sem respostas, não gera e pergunta pedra, cuba, torneira, vaso e acessibilidade", !semResp.ok && ["Qual pedra", "tipo de cuba", "tipo de torneira", "tipo de vaso", "barras de acessibilidade"].every((x) => pq.includes(x)), pq.slice(0, 80));
  conferir("sem conferir o desenho lido, não gera", !(await gerarConjuntoMolhadas(mpa, (await novoCj([EXEMPLOS.bwc1], RESP({ modeloConferido: false }))).id)).ok);
  const cjr = await gerarConjuntoMolhadas(mpa, (await novoCj(Object.values(EXEMPLOS), RESP())).id);
  conferir("gera o conjunto dos 4 ambientes de teste", cjr.ok);
  if (cjr.ok) {
    const sd = cjr.dados!.saidas;
    conferir("um executivo por ambiente e uma marmoraria por bancada", sd.filter((x) => x.tipo === "executivo").length === 4 && sd.filter((x) => x.tipo === "marmoraria").length === 4);
    conferir("nenhuma prancha com texto ou cota sobreposto", sd.every((x) => x.sobreposicoes === 0), sd.filter((x) => x.sobreposicoes).map((x) => x.nome).join("; "));
    const tx = (await imagensPorPagina((await lerArquivo(sd.find((x) => x.nome.startsWith("BWC 2"))!.pdf))!)).texto.join(" ");
    conferir("folhas numeradas no conjunto (03/08 e 04/08)", tx.includes("03/08") && tx.includes("04/08"));
    conferir("executivo tem planta, vistas, detalhe, quadro, notas e carimbo", ["PLANTA BAIXA - BWC 2 (PNE)", "VISTA A - PAREDE", "DETALHE DA BANCADA", "QUADRO DE PONTOS E ALTURAS", "NOTAS", "EXECUTIVO - ÁREAS MOLHADAS", "SEM ESCALA", "PERSPECTIVA ISOMÉTRICA"].every((x) => tx.includes(x)));
    conferir("pontos padrão: lavatório AF 0,60 / ES 0,50 e vaso AF 0,25", tx.includes("AF 0,60") && tx.includes("ES 0,50") && tx.includes("AF 0,25"));
    conferir("barras citam a NBR 9050:2020, item 7.7.2.2", tx.includes("NBR 9050:2020") && tx.includes("7.7.2.2"));
  }
  const bb = barrasDoAmbiente(EXEMPLOS.bwc2pne, nbr(), true).barras, perto = (x: number, y: number) => Math.abs(x - y) < 0.006;
  const bf = bb.find((x) => x.tipo === "fundo")!, bl = bb.find((x) => x.tipo === "lateral")!, bv = bb.find((x) => x.tipo === "vertical")!;
  conferir("NBR 9050 fundo: 0,80 m, passa 0,30 m do eixo para a parede lateral, a 0,89 m com caixa acoplada", bf.parede === "S" && perto(bf.de, 0.48) && perto(bf.ate, 1.28) && perto(bf.z1, 0.89));
  conferir("NBR 9050 fundo sem caixa acoplada: 0,75 m", perto(barrasDoAmbiente(EXEMPLOS.bwc2pne, nbr(), false).barras.find((x) => x.tipo === "fundo")!.z1, 0.75));
  conferir("NBR 9050 lateral: 0,80 m a 0,75 m de altura, terminando 0,50 m além da borda frontal da bacia", bl.parede === "L" && perto(bl.ate - bl.de, 0.8) && perto(bl.z1, 0.75) && perto(1.98 - bl.de, 0.65 + 0.5));
  conferir("NBR 9050 vertical: 0,70 m, 0,10 m acima da horizontal, a 0,30 m da borda frontal", bv.parede === "L" && perto(bv.z2 - bv.z1, 0.7) && perto(bv.z1, 0.85) && perto(1.98 - bv.de, 0.65 + 0.3));
  conferir("avisa quando o vaso está longe demais da parede para a barra lateral", barrasDoAmbiente({ ...EXEMPLOS.bwc2pne, vasos: [{ parede: "S", eixo: 0.75 }] }, nbr(), true).avisos.some((x) => x.includes("7.7.2.2.1")));
  conferir("avisa porta abrindo para dentro em sanitário acessível (7.5 f)", barrasDoAmbiente({ ...EXEMPLOS.bwc1 }, nbr(), true).avisos.some((x) => x.includes("alínea f")));
  const bd = bancadaDoAmbiente(EXEMPLOS.bwc1, 0, RESP());
  conferir("laterais da bancada saem da planta, sem perguntar (BWC 1: esquerda aberta, direita na parede)", bd.lateralEsquerda === "aberta" && bd.lateralDireita === "parede" && bd.comprimento === 0.95);

  console.log("Marcenaria (SketchUp e móvel por medidas)");
  const { gerarMarcenaria } = await import("../src/lib/servicos");
  const { salvarArquivo } = await import("../src/lib/arquivos");
  const MC = await import("../src/lib/marcenaria/modelo");
  const EX = await import("./exemplo-marcenaria");
  const novaMarc = (x: object) => salvar("marcenarias", { empresaId: "mpa", projetoId: "x", arquivo: null, papeis: {}, moveis: [], planta: null, pdf: null, xlsx: null, verificacao: null, respostas: EX.RESP_MARC(), ...x } as never);
  await salvarArquivo("mpa/teste/balcao_marcenaria.json", Buffer.from(JSON.stringify(EX.modeloSketchUp())));
  const sk = MC.moveisDoModelo(EX.modeloSketchUp())[0], refm = MC.movelPorMedidas(EX.BALCAO, EX.RESP_MARC());
  const contar = (m: { pecas: { papel: string }[] }) => JSON.stringify(MC.PAPEIS.map((k) => m.pecas.filter((x) => x.papel === k).length));
  conferir("modelo girado e fora da origem: acha a frente e as medidas (1800 x 550 x 850)", sk.L === 1800 && sk.P === 550 && sk.A === 850);
  conferir("peças sem nome: tipo deduzido pela posição igual ao do móvel de referência", contar(sk) === contar(refm), contar(sk));
  conferir("ferragem modelada não vira chapa", sk.explicitas.some((x) => x.nome.includes("Corrediça")) && !sk.pecas.some((x) => x.papel === "ferragem"));
  const sr = await gerarMarcenaria(mpa, (await novaMarc({ arquivo: "mpa/teste/balcao_marcenaria.json", moveis: [MC.movelParamNovo(1)], respostas: MC.respostasMarcenariaIniciais() })).id);
  const pm = sr.ok ? "" : sr.erros.join(" | ");
  conferir("sem respostas, não gera e pergunta MDF, acabamento, veio, puxador, corrediça, dobradiça e o móvel", !sr.ok && ["espessura do MDF", "acabamento", "veio", "puxador", "corrediça", "dobradiça", "tem rodapé", "portas, de gavetas ou aberto"].every((x) => pm.includes(x)), pm.slice(0, 120));
  conferir("sem a conferência marcada, não gera", !(await gerarMarcenaria(mpa, (await novaMarc({ moveis: [EX.BALCAO], respostas: EX.RESP_MARC({ conferido: false }) })).id)).ok);
  conferir("bloqueia módulos que não fecham com a largura", !(await gerarMarcenaria(mpa, (await novaMarc({ moveis: [{ ...EX.BALCAO, modulos: EX.BALCAO.modulos.map((x) => ({ ...x, largura: 900 })) }] })).id)).ok);
  const gm = await gerarMarcenaria(mpa, (await novaMarc({ arquivo: "mpa/teste/balcao_marcenaria.json", moveis: [EX.ROUPEIRO] })).id);
  conferir("gera pranchas (PDF) e planilha (XLSX)", gm.ok && !!gm.dados?.pdf && !!gm.dados?.xlsx, gm.ok ? "" : gm.erros.join("; "));
  if (gm.ok) {
    conferir("nenhum texto ou cota sobreposto", gm.dados!.verificacao!.sobreposicoes === 0, String(gm.dados!.verificacao!.sobreposicoes));
    const pg = await imagensPorPagina((await lerArquivo(gm.dados!.pdf!))!), tm = pg.texto.join(" ");
    conferir("folhas numeradas e nenhuma em branco", pg.texto.length === gm.dados!.verificacao!.folhas && pg.texto.every((t, i) => t.includes(`FOLHA ${String(i + 1).padStart(2, "0")}/${String(pg.texto.length).padStart(2, "0")}`) && t.length > 250));
    conferir("tem visão geral, vista interna, cortes, explodida, cartões, lista, ferragens e plano de corte", ["VISTA FRONTAL", "VISTA INTERNA", "CORTE A-A", "CORTE B-B", "VISTA EXPLODIDA", "CARTÕES DE FABRICAÇÃO", "LISTA DE PEÇAS", "FERRAGENS", "RESUMO DE MATERIAIS", "PLANO DE CORTE"].every((x) => tm.replace(/\s/g, "").includes(x.replace(/\s/g, ""))));
    conferir("móvel por medidas sai marcado como ESTIMATIVA; o do SketchUp, não", pg.texto.some((t) => t.includes("Roupeiro") && t.includes("ESTIMATIVA: PEÇAS GERADAS POR REGRA")) && !pg.texto[0].includes("ESTIMATIVA"));
    conferir("aviso de conferir medidas no local e padrões de mercado", tm.includes("CONFERIR MEDIDAS NO LOCAL") && tm.includes("conferir com o catálogo do fornecedor"));
    conferir("planilha é um XLSX de verdade", (await lerArquivo(gm.dados!.xlsx!))!.subarray(0, 2).toString() === "PK");
  }
  const itensT = MC.listaDePecas([refm, MC.movelPorMedidas(EX.ROUPEIRO, EX.RESP_MARC())], EX.RESP_MARC());
  for (const veio of [true, false]) {
    const pl = MC.planoDeCorte(itensT, veio), W = 2730, H = 1820;
    const dentro = pl.chapas.every((c) => c.pecas.every((x) => x.x >= 0 && x.y >= 0 && x.x + x.c <= W + 0.01 && x.y + x.l <= H + 0.01));
    const livre = pl.chapas.every((c) => c.pecas.every((a, i) => c.pecas.every((b, j) => j <= i || a.x + a.c <= b.x + 0.01 || b.x + b.c <= a.x + 0.01 || a.y + a.l <= b.y + 0.01 || b.y + b.l <= a.y + 0.01)));
    const todas = pl.chapas.reduce((n, c) => n + c.pecas.length, 0) === itensT.reduce((n, it) => n + it.qtd, 0);
    conferir(`plano de corte ${veio ? "com" : "sem"} veio: todas as peças dentro da chapa, sem se sobrepor${veio ? " e sem girar" : ""}`, dentro && livre && todas && pl.fora.length === 0 && (!veio || pl.chapas.every((c) => c.pecas.every((x) => !x.girada))));
  }
  conferir("dobradiças pela altura da porta (2, 3, 4, 5)", [800, 1500, 2000, 2400].map(MC.dobradicasPorAltura).join() === "2,3,4,5");
  conferir("corrediça: maior padrão que cabe na profundidade menos 50 mm", MC.corredicaPara(550) === 500 && MC.corredicaPara(420) === 350);

  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exit(falhas ? 1 : 0);
})();
