// Login por e-mail e senha. Senhas com scrypt; sessão em cookie assinado (HMAC), só no servidor.
import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listar, obter, salvar, PASTA_DADOS } from "./banco";
import { EMPRESAS_INICIAIS } from "./marca";
import type { Empresa, Usuario } from "./tipos";

const COOKIE = "mpa_sessao";
const COOKIE_EMPRESA = "mpa_empresa";
const DIAS = 30;

function segredo(): string {
  if (process.env.MPA_SEGREDO) return process.env.MPA_SEGREDO;
  const arq = path.join(PASTA_DADOS, "segredo.txt");
  try { return fs.readFileSync(arq, "utf8"); } catch {
    fs.mkdirSync(PASTA_DADOS, { recursive: true });
    const s = randomBytes(32).toString("hex");
    fs.writeFileSync(arq, s);
    return s;
  }
}

export function hashSenha(senha: string) {
  const sal = randomBytes(16).toString("hex");
  return sal + ":" + scryptSync(senha, sal, 64).toString("hex");
}
export function conferirSenha(senha: string, hash: string) {
  const [sal, h] = hash.split(":");
  if (!sal || !h) return false;
  const a = scryptSync(senha, sal, 64);
  const b = Buffer.from(h, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const assinar = (corpo: string) => createHmac("sha256", segredo()).update(corpo).digest("hex");

export async function criarSessao(usuarioId: string) {
  const corpo = Buffer.from(JSON.stringify({ u: usuarioId, e: Date.now() + DIAS * 864e5 })).toString("base64url");
  (await cookies()).set(COOKIE, corpo + "." + assinar(corpo), { httpOnly: true, sameSite: "lax", path: "/", maxAge: DIAS * 86400, secure: process.env.NODE_ENV === "production" && process.env.MPA_HTTPS === "1" });
}
export async function encerrarSessao() { (await cookies()).delete(COOKIE); }

export async function usuarioAtual(): Promise<Usuario | null> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return null;
  const [corpo, ass] = v.split(".");
  if (!corpo || !ass) return null;
  const esperado = assinar(corpo);
  if (ass.length !== esperado.length || !timingSafeEqual(Buffer.from(ass), Buffer.from(esperado))) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(corpo, "base64url").toString());
    if (Date.now() > e) return null;
    return await obter<Usuario>("usuarios", u);
  } catch { return null; }
}

export async function semear() {
  const existentes = await listar<Empresa>("empresas");
  for (const e of EMPRESAS_INICIAIS) if (!existentes.find((x) => x.id === e.id)) await salvar<Empresa>("empresas", e);
}

export interface Contexto { usuario: Usuario; empresa: Empresa; empresas: Empresa[] }

// Toda página e toda ação do app começa aqui: sem login, vai para /login.
export async function contexto(): Promise<Contexto> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect((await listar<Usuario>("usuarios")).length ? "/login" : "/primeiro-acesso");
  const todas = await listar<Empresa>("empresas");
  const ordem = EMPRESAS_INICIAIS.map((e) => e.id);
  const empresas = todas.filter((e) => usuario.empresas.includes(e.id)).sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
  const escolhida = (await cookies()).get(COOKIE_EMPRESA)?.value;
  const empresa = empresas.find((e) => e.id === escolhida) ?? empresas.find((e) => e.id === "mpa") ?? empresas[0];
  if (!empresa) redirect("/login");
  return { usuario, empresa, empresas };
}

export async function definirEmpresa(id: string) {
  (await cookies()).set(COOKIE_EMPRESA, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
}
