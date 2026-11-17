"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listar, obter, salvar } from "@/lib/banco";
import { lerArquivo, removerArquivo, salvarArquivo, nomeSeguro } from "@/lib/arquivos";
import { conferirSenha, contexto, criarSessao, definirEmpresa, encerrarSessao, hashSenha, semear } from "@/lib/sessao";
import type { ConjuntoMarcenaria, MovelLido, PlantaMarcenaria, RecorteMarcenaria, ConjuntoMolhadas, Detalhamento, Cliente, DadosMemorial, DadosProposta, Empresa, Marca, Memorial, Projeto, Proposta, StatusProposta, TipoMemorial, Usuario } from "@/lib/tipos";
import { propostaInicial } from "@/lib/documentos/textos-proposta";
import { memorialInicial } from "@/lib/documentos/regras-memorial";
import { gerarMarcenaria, moveisDoArquivo, gerarConjuntoMolhadas, gerarMarmoraria, gerarMemorial, gerarProposta, type Resultado } from "@/lib/servicos";
import { NBR9050_PADRAO, respostasIniciais, type Ambiente, type ParametroNBR, type RespostasAmbiente } from "@/lib/pranchas/ambiente";
import { bancadaInicial, type DadosBancada } from "@/lib/pranchas/regras-bancada";
import { iaDisponivel, lerAreasMolhadas, lerPlanta, type LeituraPlanta } from "@/lib/ia";
import { faltaNaMarca } from "@/lib/marca";
import { lerPlantaVetorial, recortarAmbientes } from "@/lib/leitura-vetorial";
import { listaDePecas, respostasMarcenariaIniciais, type RespostasMarcenaria } from "@/lib/marcenaria/modelo";
import { renderizar } from "@/lib/pranchas/iso";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (v: string): number | null => {
  if (!v.trim()) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// ---------- LOGIN ----------
export async function primeiroAcesso(_: unknown, f: FormData): Promise<{ erro?: string }> {
  if ((await listar<Usuario>("usuarios")).length) redirect("/login");
  const nome = txt(f, "nome"), email = txt(f, "email").toLowerCase(), senha = String(f.get("senha") ?? "");
  if (!nome || !email.includes("@")) return { erro: "Informe seu nome e um e-mail válido." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  await semear();
  const empresas = (await listar<Empresa>("empresas")).map((e) => e.id);
  const u = await salvar<Usuario>("usuarios", { nome, email, senhaHash: hashSenha(senha), empresas });
  await criarSessao(u.id);
  redirect("/");
}

export async function entrar(_: unknown, f: FormData): Promise<{ erro?: string }> {
  const email = txt(f, "email").toLowerCase(), senha = String(f.get("senha") ?? "");
  const u = (await listar<Usuario>("usuarios")).find((x) => x.email === email);
  if (!u || !conferirSenha(senha, u.senhaHash)) return { erro: "E-mail ou senha incorretos." };
  await criarSessao(u.id);
  redirect("/");
}

export async function sair() { await encerrarSessao(); redirect("/login"); }

export async function criarUsuario(_: unknown, f: FormData): Promise<{ erro?: string; ok?: string }> {
  const { usuario } = await contexto();
  const nome = txt(f, "nome"), email = txt(f, "email").toLowerCase(), senha = String(f.get("senha") ?? "");
  if (!nome || !email.includes("@")) return { erro: "Informe o nome e um e-mail válido." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if ((await listar<Usuario>("usuarios")).some((x) => x.email === email)) return { erro: "Já existe um usuário com esse e-mail." };
  await salvar<Usuario>("usuarios", { nome, email, senhaHash: hashSenha(senha), empresas: usuario.empresas });
  revalidatePath("/empresas");
  return { ok: `Usuário ${nome} criado.` };
}

export async function trocarEmpresa(f: FormData) {
  const { empresas } = await contexto();
  const id = txt(f, "empresa");
  if (empresas.some((e) => e.id === id)) await definirEmpresa(id);
  redirect("/");
}

// ---------- MARCAS ----------
export async function salvarMarca(_: unknown, f: FormData): Promise<{ erro?: string; ok?: string }> {
  const { empresas } = await contexto();
  const empresa = empresas.find((e) => e.id === txt(f, "empresaId"));
  if (!empresa) return { erro: "Empresa não encontrada." };
  const cor = (k: string) => { const v = txt(f, k); return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : ""; };
  const m: Marca = {
    ...empresa.marca,
    azul: cor("azul"), dourado: cor("dourado"),
    offwhite: cor("offwhite") || "#F7F4EE", bege: cor("bege") || "#E8DFD2", begeLinha: cor("begeLinha") || "#D9C9A3",
    fonte: txt(f, "fonte") || "Montserrat",
    razaoSocial: txt(f, "razaoSocial"), cidade: txt(f, "cidade"), telefone: txt(f, "telefone"), email: txt(f, "email"),
    instagram: txt(f, "instagram"), endereco: txt(f, "endereco"), responsavelTecnico: txt(f, "responsavelTecnico"), registro: txt(f, "registro"),
  };
  for (const [campo, chave] of [["logoClaro", "logoClaro"], ["logoEscuro", "logoEscuro"]] as const) {
    const arq = f.get(campo);
    if (arq instanceof File && arq.size > 0) {
      if (arq.type !== "image/png") return { erro: "O logo precisa ser um arquivo PNG (de preferência com fundo transparente)." };
      const caminho = `${empresa.id}/marca/${chave}.png`;
      await salvarArquivo(caminho, Buffer.from(await arq.arrayBuffer()), "image/png");
      m[chave] = caminho;
    }
  }
  m.definida = faltaNaMarca(m).length === 0;
  await salvar<Empresa>("empresas", { ...empresa, marca: m });
  revalidatePath("/", "layout");
  return { ok: m.definida ? "Marca salva e pronta para uso." : `Marca salva. Ainda falta: ${faltaNaMarca(m).join(", ")}.` };
}

// ---------- PROJETOS ----------
export async function criarProjeto(_: unknown, f: FormData): Promise<{ erro?: string }> {
  const { empresa } = await contexto();
  const obra = txt(f, "obra"), clienteNome = txt(f, "clienteNome"), clienteId = txt(f, "clienteId");
  if (!obra) return { erro: "Dê um nome para a obra ou projeto." };
  if (!clienteId && !clienteNome) return { erro: "Escolha um cliente já cadastrado ou digite o nome de um novo." };
  let cid = clienteId;
  if (!cid) {
    const c = await salvar<Cliente>("clientes", { empresaId: empresa.id, nome: clienteNome, cpfCnpj: txt(f, "clienteCpf"), telefone: txt(f, "clienteTelefone"), email: txt(f, "clienteEmail") });
    cid = c.id;
  } else if (!(await obter<Cliente>("clientes", cid, empresa.id))) return { erro: "Cliente não encontrado." };
  const exec = txt(f, "contratouExecucao");
  const p = await salvar<Projeto>("projetos", {
    empresaId: empresa.id, clienteId: cid, obra, endereco: txt(f, "endereco"), municipio: txt(f, "municipio"), tipo: txt(f, "tipo"),
    areaM2: num(txt(f, "areaM2")), contrato: txt(f, "contrato"),
    contratouExecucao: exec === "sim" ? true : exec === "nao" ? false : null, etapaAtual: 0, arquivos: [], arquivado: false,
  });
  redirect(`/projetos/${p.id}`);
}

export async function atualizarProjeto(_: unknown, f: FormData): Promise<{ erro?: string; ok?: string }> {
  const { empresa } = await contexto();
  const p = await obter<Projeto>("projetos", txt(f, "id"), empresa.id);
  if (!p) return { erro: "Projeto não encontrado." };
  const obra = txt(f, "obra");
  if (!obra) return { erro: "O nome da obra não pode ficar vazio." };
  const exec = txt(f, "contratouExecucao");
  await salvar<Projeto>("projetos", { ...p, obra, endereco: txt(f, "endereco"), municipio: txt(f, "municipio"), tipo: txt(f, "tipo"), areaM2: num(txt(f, "areaM2")), contrato: txt(f, "contrato"), contratouExecucao: exec === "sim" ? true : exec === "nao" ? false : null });
  const c = await obter<Cliente>("clientes", p.clienteId, empresa.id);
  if (c) await salvar<Cliente>("clientes", { ...c, nome: txt(f, "clienteNome") || c.nome, cpfCnpj: txt(f, "clienteCpf"), telefone: txt(f, "clienteTelefone"), email: txt(f, "clienteEmail") });
  revalidatePath("/", "layout");
  return { ok: "Dados salvos." };
}

export async function definirEtapa(f: FormData) {
  const { empresa } = await contexto();
  const p = await obter<Projeto>("projetos", txt(f, "id"), empresa.id);
  const n = Number(txt(f, "etapa"));
  if (p && Number.isInteger(n) && n >= 0 && n <= 13) await salvar<Projeto>("projetos", { ...p, etapaAtual: n });
  revalidatePath("/", "layout");
}

export async function arquivarProjeto(f: FormData) {
  const { empresa } = await contexto();
  const p = await obter<Projeto>("projetos", txt(f, "id"), empresa.id);
  if (p) await salvar<Projeto>("projetos", { ...p, arquivado: txt(f, "arquivar") === "1" });
  revalidatePath("/", "layout");
}

export async function excluirArquivo(f: FormData) {
  const { empresa } = await contexto();
  const p = await obter<Projeto>("projetos", txt(f, "id"), empresa.id);
  const caminho = txt(f, "caminho");
  if (p && p.arquivos.some((a) => a.caminho === caminho)) {
    await removerArquivo(caminho);
    await salvar<Projeto>("projetos", { ...p, arquivos: p.arquivos.filter((a) => a.caminho !== caminho) });
  }
  revalidatePath(`/projetos/${p?.id}`);
}

// ---------- PROPOSTAS ----------
export async function novaProposta(f: FormData) {
  const ctx = await contexto();
  const projetoId = txt(f, "projetoId") || null;
  // Proposta avulsa: a empresa é perguntada na tela (pergunta obrigatória do módulo P02).
  const escolhida = txt(f, "empresaId");
  const empresa = (!projetoId && ctx.empresas.find((e) => e.id === escolhida)) || ctx.empresa;
  if (empresa.id !== ctx.empresa.id) await definirEmpresa(empresa.id);
  let base: Partial<DadosProposta> = {};
  let versao = 1;
  if (projetoId) {
    const p = await obter<Projeto>("projetos", projetoId, empresa.id);
    if (!p) redirect("/");
    const c = await obter<Cliente>("clientes", p.clienteId, empresa.id);
    base = { clienteNome: c?.nome ?? "", obra: p.obra, local: [p.endereco, p.municipio].filter(Boolean).join(", ") };
    versao = (await listar<Proposta>("propostas", empresa.id)).filter((x) => x.projetoId === projetoId).length + 1;
  }
  const pr = await salvar<Proposta>("propostas", { empresaId: empresa.id, projetoId, versao, status: "rascunho", dados: propostaInicial(base), docx: null, pdf: null, verificacao: null });
  redirect(`/propostas/${pr.id}`);
}

export async function salvarProposta(id: string, dados: DadosProposta): Promise<Resultado> {
  const { empresa } = await contexto();
  const pr = await obter<Proposta>("propostas", id, empresa.id);
  if (!pr) return { ok: false, erros: ["Proposta não encontrada."] };
  await salvar<Proposta>("propostas", { ...pr, dados });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function salvarEGerarProposta(id: string, dados: DadosProposta): Promise<Resultado<Proposta>> {
  const { empresa } = await contexto();
  const s = await salvarProposta(id, dados);
  if (!s.ok) return s;
  const r = await gerarProposta(empresa, id);
  revalidatePath("/", "layout");
  return r;
}

export async function statusProposta(f: FormData) {
  const { empresa } = await contexto();
  const pr = await obter<Proposta>("propostas", txt(f, "id"), empresa.id);
  const s = txt(f, "status") as StatusProposta;
  if (pr && ["rascunho", "enviada", "aprovada", "recusada"].includes(s)) await salvar<Proposta>("propostas", { ...pr, status: s });
  revalidatePath("/", "layout");
}

// ---------- MEMORIAL ----------
export async function novoMemorial(f: FormData) {
  const { empresa } = await contexto();
  const p = await obter<Projeto>("projetos", txt(f, "projetoId"), empresa.id);
  if (!p) redirect("/");
  const c = await obter<Cliente>("clientes", p.clienteId, empresa.id);
  const revisao = (await listar<Memorial>("memoriais", empresa.id)).filter((x) => x.projetoId === p.id).length;
  const dados = memorialInicial({ proprietario: c?.nome ?? "", cpfCnpj: c?.cpfCnpj ?? "", obra: p.obra, endereco: p.endereco, municipio: p.municipio, tipoObra: "" });
  const me = await salvar<Memorial>("memoriais", { empresaId: empresa.id, projetoId: p.id, revisao, dados, saidas: {} });
  redirect(`/memoriais/${me.id}`);
}

export async function salvarMemorial(id: string, dados: DadosMemorial): Promise<Resultado> {
  const { empresa } = await contexto();
  const me = await obter<Memorial>("memoriais", id, empresa.id);
  if (!me) return { ok: false, erros: ["Memorial não encontrado."] };
  await salvar<Memorial>("memoriais", { ...me, dados });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function salvarEGerarMemorial(id: string, dados: DadosMemorial, tipos: TipoMemorial[]): Promise<Resultado<Memorial>> {
  const { empresa } = await contexto();
  const s = await salvarMemorial(id, dados);
  if (!s.ok) return s;
  const r = await gerarMemorial(empresa, id, tipos);
  revalidatePath("/", "layout");
  return r;
}

export async function lerPlantaDoProjeto(projetoId: string, caminho: string): Promise<Resultado<LeituraPlanta>> {
  const { empresa } = await contexto();
  const p = await obter<Projeto>("projetos", projetoId, empresa.id);
  const arq = p?.arquivos.find((a) => a.caminho === caminho);
  if (!p || !arq) return { ok: false, erros: ["Arquivo não encontrado no projeto."] };
  const ext = arq.nome.toLowerCase().split(".").pop() ?? "";
  const mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" } as Record<string, string>)[ext];
  if (!mime) return { ok: false, erros: ["A leitura automática aceita planta em PNG, JPG, WEBP ou PDF."] };
  const buf = await lerArquivo(caminho);
  if (!buf) return { ok: false, erros: ["Não consegui abrir o arquivo."] };
  // PDF vetorial: os nomes dos ambientes saem do texto do próprio PDF, sem chave
  if (mime === "application/pdf") {
    try {
      const l = await lerPlantaVetorial(buf);
      const alturas = l.rotulos.map((r) => Math.round(r.alt * 2) / 2), comum = alturas.sort((a, b) => alturas.filter((x) => x === b).length - alturas.filter((x) => x === a).length)[0];
      const nomes = [...new Set(l.rotulos.filter((r) => Math.abs(r.alt - comum) <= comum * 0.3).map((r) => r.nome))];
      if (nomes.length >= 2) return { ok: true, dados: { ambientes: nomes.map((nome) => ({ nome, areaM2: null })), observacoes: "Nomes lidos do texto do PDF, sem inteligência artificial. Ambientes repetidos aparecem uma vez só. As áreas não foram lidas: preencha as que quiser." } };
    } catch { /* segue para a leitura com a chave, se houver */ }
  }
  if (!iaDisponivel()) return { ok: false, erros: ["Sem a chave da API do Claude, a leitura só funciona com PDF exportado direto do programa de desenho (não com foto ou imagem). Preencha os ambientes à mão ou cadastre a chave (veja o LEIA-ME)."] };
  try {
    return { ok: true, dados: await lerPlanta(buf, mime) };
  } catch (e) {
    return { ok: false, erros: ["A leitura automática falhou: " + (e instanceof Error ? e.message : "erro desconhecido") + " Você pode preencher os ambientes à mão."] };
  }
}

// ---------- DETALHAMENTOS (Fase 2) ----------
export async function novoDetalhamento(f: FormData) {
  const { empresa } = await contexto();
  const p = await obter<Projeto>("projetos", txt(f, "projetoId"), empresa.id);
  if (!p) redirect("/");
  const c = await obter<Cliente>("clientes", p.clienteId, empresa.id);
  const det = await salvar<Detalhamento>("detalhamentos", {
    empresaId: empresa.id, projetoId: p.id, tipo: "marmoraria", plantaSituacao: null, pdf: null, verificacao: null,
    dados: bancadaInicial({ cliente: c?.nome ?? "", local: [p.endereco, p.municipio].filter(Boolean).join(", ") }),
  });
  redirect(`/detalhamentos/${det.id}`);
}

export async function salvarDetalhamento(id: string, dados: DadosBancada, plantaSituacao: string | null): Promise<Resultado> {
  const { empresa } = await contexto();
  const det = await obter<Detalhamento>("detalhamentos", id, empresa.id);
  if (!det) return { ok: false, erros: ["Detalhamento não encontrado."] };
  const p = await obter<Projeto>("projetos", det.projetoId, empresa.id);
  const planta = plantaSituacao && p?.arquivos.some((a) => a.caminho === plantaSituacao) ? plantaSituacao : null;
  await salvar<Detalhamento>("detalhamentos", { ...det, dados, plantaSituacao: planta });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function salvarEGerarDetalhamento(id: string, dados: DadosBancada, plantaSituacao: string | null): Promise<Resultado<Detalhamento>> {
  const { empresa } = await contexto();
  const s = await salvarDetalhamento(id, dados, plantaSituacao);
  if (!s.ok) return s;
  const r = await gerarMarmoraria(empresa, id);
  revalidatePath("/", "layout");
  return r;
}

// ---------- ÁREAS MOLHADAS A PARTIR DA PLANTA ----------
export async function novoConjuntoMolhadas(f: FormData) {
  const { empresa } = await contexto();
  const p = await obter<Projeto>("projetos", txt(f, "projetoId"), empresa.id);
  if (!p) redirect("/");
  const c = await obter<Cliente>("clientes", p.clienteId, empresa.id);
  const planta = p.arquivos.find((a) => a.categoria === "planta");
  const cj = await salvar<ConjuntoMolhadas>("molhadas", {
    empresaId: empresa.id, projetoId: p.id, planta: planta?.caminho ?? null, ambientes: [], parametros: NBR9050_PADRAO.map((x) => ({ ...x })), saidas: [], avisos: [],
    respostas: respostasIniciais({ cliente: c?.nome ?? "", local: [p.endereco, p.municipio].filter(Boolean).join(", "), origemPlanta: planta?.nome ?? "" }),
  });
  redirect(`/areas-molhadas/${cj.id}`);
}

// Leitura da planta para as áreas molhadas. PDF vetorial: lê pelo texto e pelo traço, sem chave. Imagem ou PDF escaneado: só com a chave da API.
export async function lerAmbientesDaPlanta(id: string, caminho: string): Promise<Resultado<{ ambientes: Ambiente[]; observacoes: string }>> {
  const { empresa } = await contexto();
  const cj = await obter<ConjuntoMolhadas>("molhadas", id, empresa.id);
  const p = cj && (await obter<Projeto>("projetos", cj.projetoId, empresa.id));
  const arq = p?.arquivos.find((a) => a.caminho === caminho);
  if (!cj || !arq) return { ok: false, erros: ["Planta não encontrada no projeto."] };
  const ext = arq.nome.toLowerCase().split(".").pop() ?? "";
  const mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" } as Record<string, string>)[ext];
  if (!mime) return { ok: false, erros: ["A leitura automática aceita planta em PDF, PNG, JPG ou WEBP."] };
  const buf = await lerArquivo(caminho);
  if (!buf) return { ok: false, erros: ["Não consegui abrir o arquivo."] };
  let motivo = "A leitura sem a chave da API só funciona com PDF exportado direto do programa de desenho (não com foto ou imagem).";
  if (mime === "application/pdf") {
    try {
      const l = await lerPlantaVetorial(buf);
      if (l.ok) {
        const recortes = await recortarAmbientes(buf, l.ambientes).catch(() => []);
        const carimbo = Date.now();
        const ambientes: Ambiente[] = [];
        for (let i = 0; i < l.ambientes.length; i++) {
          const r = recortes[i]; let recorte: Ambiente["recorte"] = null;
          if (r) { const imagem = `${empresa.id}/molhadas/${cj.id}/recorte_${carimbo}_${i + 1}.png`; await salvarArquivo(imagem, r.png, "image/png"); recorte = { imagem, largura: r.largura, altura: r.altura, x0: r.x0, y0: r.y0, pxPorM: r.pxPorM }; }
          ambientes.push({ ...l.ambientes[i].ambiente, recorte });
        }
        return { ok: true, dados: { ambientes, observacoes: l.observacoes } };
      }
      motivo = l.motivo ?? motivo;
    } catch (e) {
      motivo = "Não consegui ler o traço deste PDF: " + (e instanceof Error ? e.message : "erro desconhecido");
    }
  }
  if (!iaDisponivel()) return { ok: false, erros: [motivo + " Você pode adicionar os ambientes à mão, ou cadastrar a chave da API do Claude para ler imagens (veja o LEIA-ME)."] };
  try {
    const l = await lerAreasMolhadas(buf, mime);
    const ambientes: Ambiente[] = l.ambientes.map((a) => ({
      ...a, acessivel: "", porta: a.porta ? { ...a.porta, altura: 2.1 } : null,
      chuveiro: a.chuveiro ? { ...a.chuveiro, registros: a.chuveiro.registros >= 2 ? 2 : 1 } : null,
    }));
    return { ok: true, dados: { ambientes, observacoes: `${l.observacoes} Escala lida: ${l.escala}. Leitura feita por inteligência artificial: é aproximada.` } };
  } catch (e) {
    return { ok: false, erros: ["A leitura automática falhou: " + (e instanceof Error ? e.message : "erro desconhecido")] };
  }
}

export async function salvarConjuntoMolhadas(id: string, dados: { planta: string | null; ambientes: Ambiente[]; respostas: RespostasAmbiente; parametros: ParametroNBR[] }): Promise<Resultado> {
  const { empresa } = await contexto();
  const cj = await obter<ConjuntoMolhadas>("molhadas", id, empresa.id);
  if (!cj) return { ok: false, erros: ["Conjunto não encontrado."] };
  await salvar<ConjuntoMolhadas>("molhadas", { ...cj, ...dados });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function salvarEGerarConjuntoMolhadas(id: string, dados: { planta: string | null; ambientes: Ambiente[]; respostas: RespostasAmbiente; parametros: ParametroNBR[] }): Promise<Resultado<ConjuntoMolhadas>> {
  const { empresa } = await contexto();
  const s = await salvarConjuntoMolhadas(id, dados);
  if (!s.ok) return s;
  const r = await gerarConjuntoMolhadas(empresa, id);
  revalidatePath("/", "layout");
  return r;
}

// ---------- MARCENARIA ----------
export async function novaMarcenaria(f: FormData) {
  const { empresa } = await contexto();
  const p = await obter<Projeto>("projetos", txt(f, "projetoId"), empresa.id);
  if (!p) redirect("/");
  const c = await obter<Cliente>("clientes", p.clienteId, empresa.id);
  const json = p.arquivos.find((a) => /\.json$/i.test(a.nome));
  const cj = await salvar<ConjuntoMarcenaria>("marcenarias", {
    empresaId: empresa.id, projetoId: p.id, arquivo: json?.caminho ?? null, papeis: {}, moveis: [], planta: null, pdf: null, xlsx: null, verificacao: null,
    respostas: respostasMarcenariaIniciais({ cliente: c?.nome ?? "", local: [p.endereco, p.municipio].filter(Boolean).join(", ") }),
  });
  redirect(`/marcenaria/${cj.id}`);
}

type DadosMarcenaria = Pick<ConjuntoMarcenaria, "arquivo" | "papeis" | "moveis" | "planta" | "respostas">;

// Lê o arquivo exportado do SketchUp: móveis, medidas, lista de peças e uma perspectiva de cada móvel para conferir.
export async function lerModeloMarcenaria(id: string, arquivo: string, papeis: ConjuntoMarcenaria["papeis"], respostas: RespostasMarcenaria): Promise<Resultado<MovelLido[]>> {
  const { empresa } = await contexto();
  const cj = await obter<ConjuntoMarcenaria>("marcenarias", id, empresa.id);
  const p = cj && (await obter<Projeto>("projetos", cj.projetoId, empresa.id));
  if (!cj || !p?.arquivos.some((a) => a.caminho === arquivo)) return { ok: false, erros: ["Arquivo não encontrado no projeto."] };
  const lido = await moveisDoArquivo({ arquivo, papeis });
  if (lido.erro) return { ok: false, erros: [lido.erro] };
  const itens = listaDePecas(lido.moveis, respostas), saida: MovelLido[] = [];
  for (const [i, m] of lido.moveis.entries()) {
    let previa: string | null = null;
    try {
      const png = (await renderizar(m.pecas.filter((x) => x.papel !== "ferragem").map((x) => ({ min: [x.x0 / 1000, x.y0 / 1000, x.z0 / 1000] as [number, number, number], max: [x.x1 / 1000, x.y1 / 1000, x.z1 / 1000] as [number, number, number], cor: x.cor })), 520, 360)).png;
      previa = `${empresa.id}/marcenarias/${cj.id}/previa_${i + 1}.png`; await salvarArquivo(previa, png, "image/png");
    } catch { previa = null; }
    saida.push({ nome: m.nome, L: m.L, P: m.P, A: m.A, avisos: m.avisos, previa, itens: itens.filter((it) => it.movel === m.nome) });
  }
  return { ok: true, dados: saida };
}

// Lê a planta (texto e traço do PDF): nomes dos ambientes e escala, para medir os móveis clicando em cima.
async function plantaDaMarcenaria(id: string, caminho: string) {
  const { empresa } = await contexto();
  const cj = await obter<ConjuntoMarcenaria>("marcenarias", id, empresa.id);
  const p = cj && (await obter<Projeto>("projetos", cj.projetoId, empresa.id));
  const arq = p?.arquivos.find((a) => a.caminho === caminho);
  if (!cj || !arq) return { erro: "Planta não encontrada no projeto." };
  if (!/\.pdf$/i.test(arq.nome)) return { erro: "Para ler a planta sem a chave da API, envie o PDF exportado direto do programa de desenho. Com imagem, digite as medidas de cada móvel." };
  const buf = await lerArquivo(caminho);
  if (!buf) return { erro: "Não consegui abrir o arquivo." };
  try { return { empresa, cj, buf, l: await lerPlantaVetorial(buf) }; } catch (e) { return { erro: "Não consegui ler esta planta: " + (e instanceof Error ? e.message : "erro desconhecido") + " Digite as medidas de cada móvel." }; }
}

export async function prepararPlantaMarcenaria(id: string, caminho: string): Promise<Resultado<PlantaMarcenaria>> {
  const r = await plantaDaMarcenaria(id, caminho);
  if ("erro" in r) return { ok: false, erros: [r.erro!] };
  const ambientes = [...new Set(r.l.rotulos.map((x) => x.nome))];
  if (ambientes.length === 0) return { ok: false, erros: [(r.l.motivo ?? "Não encontrei nomes de ambientes escritos nesta planta.") + " Digite o ambiente e as medidas de cada móvel."] };
  const observacao = r.l.ptPorM ? "Escala encontrada: dá para medir os móveis clicando em cima da planta." : "Li os nomes dos ambientes, mas não achei a escala desta planta com segurança: digite as medidas de cada móvel (use as cotas da planta).";
  return { ok: true, dados: { arquivo: caminho, ambientes, temEscala: !!r.l.ptPorM, observacao } };
}

// Recorte da planta em volta de um ambiente (5 m para cada lado do nome), para medir o móvel com dois cliques.
export async function recortarAmbienteMarcenaria(id: string, caminho: string, ambiente: string): Promise<Resultado<RecorteMarcenaria>> {
  const r = await plantaDaMarcenaria(id, caminho);
  if ("erro" in r) return { ok: false, erros: [r.erro!] };
  const rot = r.l.rotulos.find((x) => x.nome === ambiente), pt = r.l.ptPorM;
  if (!rot || !pt) return { ok: false, erros: ["Não achei este ambiente ou a escala na planta. Digite as medidas do móvel."] };
  const raio = 5 * pt - 0.6 * pt; // a função de recorte acrescenta 0,6 m de margem
  const [c] = await recortarAmbientes(r.buf, [{ caixa: { x1: rot.x - raio, y1: rot.y - raio, x2: rot.x + raio, y2: rot.y + raio }, ptPorM: pt }], 110);
  const imagem = `${r.empresa.id}/marcenarias/${r.cj.id}/recorte_${nomeSeguro(ambiente)}.png`;
  await salvarArquivo(imagem, c.png, "image/png");
  return { ok: true, dados: { imagem, largura: c.largura, altura: c.altura, pxPorM: c.pxPorM } };
}

export async function salvarMarcenaria(id: string, dados: DadosMarcenaria): Promise<Resultado> {
  const { empresa } = await contexto();
  const cj = await obter<ConjuntoMarcenaria>("marcenarias", id, empresa.id);
  if (!cj) return { ok: false, erros: ["Marcenaria não encontrada."] };
  const p = await obter<Projeto>("projetos", cj.projetoId, empresa.id);
  const arquivo = dados.arquivo && p?.arquivos.some((a) => a.caminho === dados.arquivo) ? dados.arquivo : null;
  await salvar<ConjuntoMarcenaria>("marcenarias", { ...cj, arquivo, papeis: dados.papeis, moveis: dados.moveis, planta: dados.planta, respostas: dados.respostas });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function salvarEGerarMarcenaria(id: string, dados: DadosMarcenaria): Promise<Resultado<ConjuntoMarcenaria>> {
  const { empresa } = await contexto();
  const s = await salvarMarcenaria(id, dados);
  if (!s.ok) return s;
  const r = await gerarMarcenaria(empresa, id);
  revalidatePath("/", "layout");
  return r;
}

void nomeSeguro;
