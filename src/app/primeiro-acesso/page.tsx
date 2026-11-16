import Image from "next/image";
import { redirect } from "next/navigation";
import { primeiroAcesso } from "../acoes";
import { FormAcao } from "@/componentes/FormAcao";
import { listar } from "@/lib/banco";

export const dynamic = "force-dynamic";

export default async function PrimeiroAcesso() {
  if ((await listar("usuarios")).length) redirect("/login");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Image src="/mpa_logo_azul.png" alt="Matheus Palhares Arquitetura e Interiores" width={900} height={280} className="mb-6 w-full" priority />
      <div className="cartao">
        <h1 className="titulo mb-1 text-lg">Primeiro acesso</h1>
        <p className="mb-4 text-sm text-cinza">Crie o seu usuário. Depois você cadastra a sua funcionária em Empresas e marcas.</p>
        <FormAcao acao={primeiroAcesso} botao="Criar meu usuário" classeBotao="botao w-full">
          <label className="mb-3 block"><span className="rotulo">Seu nome</span><input name="nome" required className="campo" /></label>
          <label className="mb-3 block"><span className="rotulo">E-mail</span><input name="email" type="email" required className="campo" /></label>
          <label className="block"><span className="rotulo">Senha (mínimo 8 caracteres)</span><input name="senha" type="password" minLength={8} required className="campo" /></label>
        </FormAcao>
      </div>
    </main>
  );
}
