import Image from "next/image";
import Link from "next/link";
import { sair, trocarEmpresa } from "../acoes";
import { contexto } from "@/lib/sessao";
import { SeletorEmpresa } from "@/componentes/SeletorEmpresa";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { usuario, empresa, empresas } = await contexto();
  return (
    <>
      <header className="border-b border-begelinha bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/" className="shrink-0"><Image src="/mpa_logo_cabecalho.png" alt="Início" width={430} height={250} className="h-12 w-auto" priority /></Link>
          <nav className="flex gap-4 text-sm font-semibold text-azul">
            <Link href="/" className="hover:underline">Painel</Link>
            <Link href="/empresas" className="hover:underline">Empresas e marcas</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <SeletorEmpresa acao={trocarEmpresa} atual={empresa.id} empresas={empresas.map((e) => ({ id: e.id, sigla: e.sigla, definida: e.marca.definida }))} />
            <form action={sair}><button className="text-sm text-cinza hover:underline" title={usuario.email}>Sair</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
