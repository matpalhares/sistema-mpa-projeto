import Image from "next/image";
import { redirect } from "next/navigation";
import { entrar } from "../acoes";
import { FormAcao } from "@/componentes/FormAcao";
import { listar } from "@/lib/banco";
import { usuarioAtual } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (await usuarioAtual()) redirect("/");
  if ((await listar("usuarios")).length === 0) redirect("/primeiro-acesso");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Image src="/mpa_logo_azul.png" alt="Matheus Palhares Arquitetura e Interiores" width={900} height={280} className="mb-6 w-full" priority />
      <div className="cartao">
        <h1 className="titulo mb-4 text-lg">Entrar</h1>
        <FormAcao acao={entrar} botao="Entrar" classeBotao="botao w-full">
          <label className="mb-3 block"><span className="rotulo">E-mail</span><input name="email" type="email" required className="campo" autoComplete="email" /></label>
          <label className="block"><span className="rotulo">Senha</span><input name="senha" type="password" required className="campo" autoComplete="current-password" /></label>
        </FormAcao>
      </div>
    </main>
  );
}
