"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listar, obter, salvar } from "@/lib/banco";
import { lerArquivo, removerArquivo, salvarArquivo, nomeSeguro } from "@/lib/arquivos";
import { conferirSenha, contexto, criarSessao, definirEmpresa, encerrarSessao, hashSenha, semear } from "@/lib/sessao";
import type { Detalhamento, Cliente, DadosMemorial, DadosProposta, Empresa, Marca, Memorial, Projeto, Proposta, StatusProposta, TipoMemorial, Usuario } from "@/lib/tipos";
import { propostaInicial } from "@/lib/documentos/textos-proposta";
import { memorialInicial } from "@/lib/documentos/regras-memorial";
import { gerarMarmoraria, gerarMemorial, gerarProposta, type Resultado } from "@/lib/servicos";
import { bancadaInicial, type DadosBancada } from "@/lib/pranchas/regras-bancada";
import { iaDisponivel, lerPlanta, type LeituraPlanta } from "@/lib/ia";
import { faltaNaMarca } from "@/lib/marca";

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
  if (!iaDisponivel()) return { ok: false, erros: ["A leitura automática está desligada: a chave da API do Claude ainda não foi cadastrada. Preencha os ambientes à mão ou cadastre a chave (veja o LEIA-ME)."] };
  const p = await obter<Projeto>("projetos", projetoId, empresa.id);
  const arq = p?.arquivos.find((a) => a.caminho === caminho);
  if (!p || !arq) return { ok: false, erros: ["Arquivo não encontrado no projeto."] };
  const ext = arq.nome.toLowerCase().split(".").pop() ?? "";
  const mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" } as Record<string, string>)[ext];
  if (!mime) return { ok: false, erros: ["A leitura automática aceita planta em PNG, JPG, WEBP ou PDF."] };
  const buf = await lerArquivo(caminho);
  if (!buf) return { ok: false, erros: ["Não consegui abrir o arquivo."] };
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

void nomeSeguro;
