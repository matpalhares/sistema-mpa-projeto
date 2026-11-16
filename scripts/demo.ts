// Cria um projeto de demonstração (Escola Recriarte) para testar a interface.
// Uso: npx tsx scripts/demo.ts [caminho-da-planta.pdf]
// Os dois ambientes vêm do executivo de referência do escritório (não da leitura automática da planta).
import fs from "node:fs";
(async () => {
  const { listar, salvar } = await import("../src/lib/banco");
  const { salvarArquivo } = await import("../src/lib/arquivos");
  const { semear } = await import("../src/lib/sessao");
  const { EXEMPLOS, NBR9050_PADRAO, respostasIniciais } = await import("../src/lib/pranchas/ambiente");
  await semear();
  if ((await listar("projetos", "mpa")).some((p) => (p as { obra?: string }).obra === "Escola Recriarte Urupês (demonstração)")) { console.log("demonstração já existe"); return; }
  const c = await salvar("clientes", { empresaId: "mpa", nome: "Escola Recriarte Urupês", cpfCnpj: "", telefone: "", email: "" } as never);
  const arquivos: unknown[] = [];
  const pid = crypto.randomUUID();
  const planta = process.argv[2];
  if (planta && fs.existsSync(planta)) {
    const caminho = `mpa/projetos/${pid}/${Date.now()}_Escola_Recriarte_Planta_Baixa.pdf`;
    await salvarArquivo(caminho, fs.readFileSync(planta), "application/pdf");
    arquivos.push({ nome: "Escola_Recriarte_Planta_Baixa.pdf", caminho, tamanho: fs.statSync(planta).size, enviadoEm: new Date().toISOString(), categoria: "planta" });
  }
  await salvar("projetos", { id: pid, empresaId: "mpa", clienteId: c.id, obra: "Escola Recriarte Urupês (demonstração)", endereco: "Rua General Osório, 207, Bairro Mundo Novo", municipio: "Urupês-SP", tipo: "Comercial", areaM2: 989.5, contrato: "", contratouExecucao: null, etapaAtual: 9, arquivos, arquivado: false } as never);
  await salvar("molhadas", {
    empresaId: "mpa", projetoId: pid, planta: (arquivos[0] as { caminho?: string } | undefined)?.caminho ?? null,
    ambientes: [{ ...EXEMPLOS.bwc1, acessivel: "", observacoesLeitura: "Medidas copiadas do executivo de referência do escritório (demonstração)." }, { ...EXEMPLOS.bwc2pne, acessivel: "", observacoesLeitura: "Medidas copiadas do executivo de referência do escritório (demonstração)." }],
    respostas: respostasIniciais({ cliente: "Escola Recriarte Urupês", local: "Rua General Osório, 207, Bairro Mundo Novo, Urupês-SP", origemPlanta: "Escola Recriarte - Planta Baixa" }),
    parametros: NBR9050_PADRAO.map((x) => ({ ...x })), saidas: [], avisos: [],
  } as never);
  console.log("demonstração criada");
})();
