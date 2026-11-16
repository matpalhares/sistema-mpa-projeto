"use client";
import { useActionState } from "react";

type Estado = { erro?: string; ok?: string };
export function FormAcao({ acao, children, botao, className, classeBotao = "botao" }: {
  acao: (estado: Estado, f: FormData) => Promise<Estado>;
  children: React.ReactNode; botao: string; className?: string; classeBotao?: string;
}) {
  const [estado, enviar, pendente] = useActionState(acao, {} as Estado);
  return (
    <form action={enviar} className={className}>
      {children}
      {estado.erro && <p className="aviso mt-3" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="sucesso mt-3" role="status">{estado.ok}</p>}
      <button className={classeBotao + " mt-4"} disabled={pendente}>{pendente ? "Aguarde..." : botao}</button>
    </form>
  );
}
