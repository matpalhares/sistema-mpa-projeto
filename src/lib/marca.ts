import type { Empresa, Marca } from "./tipos";

// Paleta e dados oficiais da MPA (Projeto_Especificacao.json).
export const MARCA_MPA: Marca = {
  definida: true,
  azul: "#0D2F63",
  dourado: "#C79B63",
  offwhite: "#F7F4EE",
  bege: "#E8DFD2",
  begeLinha: "#D9C9A3",
  fonte: "Montserrat",
  razaoSocial: "Matheus Palhares Arquitetura e Construção LTDA",
  cidade: "Urupês-SP",
  telefone: "(17) 99708-0373",
  email: "arq.palhares@gmail.com",
  instagram: "@matheuspalhares.arquitetura",
  endereco: "Rua José Bonifácio 316, Centro, Urupês-SP",
  responsavelTecnico: "Arq. Matheus Palhares",
  registro: "CAU A100491-3",
  logoClaro: "recursos/marca/mpa_logo_dourado.png",
  logoEscuro: "recursos/marca/mpa_logo_azul.png",
  marcaDagua: "recursos/marca/mpa_marca_dagua.png",
  qrWhatsapp: "recursos/marca/mpa_qr_whatsapp.png",
  qrInstagram: "recursos/marca/mpa_qr_instagram.png",
  fraseEncerramento: "Nosso compromisso vai muito além de entregar um projeto. Buscamos entregar o verdadeiro lar que você e sua família merecem.",
};

// LM, Matelli e MPX têm identidade própria que ainda não foi enviada: ficam "a definir".
const marcaADefinir = (): Marca => ({
  definida: false,
  azul: "", dourado: "", offwhite: "", bege: "", begeLinha: "",
  fonte: "", razaoSocial: "", cidade: "", telefone: "", email: "",
  instagram: "", endereco: "", responsavelTecnico: "", registro: "",
});

export const EMPRESAS_INICIAIS: Empresa[] = [
  { id: "mpa", sigla: "MPA", nome: "Matheus Palhares Arquitetura e Construção", marca: MARCA_MPA },
  { id: "lm", sigla: "LM", nome: "LM Soluções Integradas", marca: marcaADefinir() },
  { id: "matelli", sigla: "Matelli", nome: "Matelli Planejados", marca: marcaADefinir() },
  { id: "mpx", sigla: "MPX", nome: "MPX Assessoria e Consultoria", marca: marcaADefinir() },
];

export function faltaNaMarca(m: Marca): string[] {
  const falta: string[] = [];
  if (!m.azul || !m.dourado) falta.push("cores");
  if (!m.razaoSocial) falta.push("razão social");
  if (!m.telefone) falta.push("telefone");
  if (!m.logoClaro || !m.logoEscuro) falta.push("logo");
  return falta;
}
