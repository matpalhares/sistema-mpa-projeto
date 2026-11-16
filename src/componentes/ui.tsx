import Link from "next/link";

export function Campo({ rotulo, nome, valor, tipo = "text", dica, obrigatorio, lista }: {
  rotulo: string; nome: string; valor?: string | number | null; tipo?: string; dica?: string; obrigatorio?: boolean; lista?: string[];
}) {
  const id = "c-" + nome;
  return (
    <label className="block" htmlFor={id}>
      <span className="rotulo">{rotulo}{!obrigatorio && (valor == null || valor === "") ? <span className="adefinir ml-2 normal-case">a definir</span> : null}</span>
      <input id={id} name={nome} type={tipo} defaultValue={valor ?? ""} className="campo" placeholder={dica} list={lista ? id + "-l" : undefined} required={obrigatorio} />
      {lista && <datalist id={id + "-l"}>{lista.map((o) => <option key={o} value={o} />)}</datalist>}
    </label>
  );
}

export function Calculo({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-1 text-xs text-cinza">
      <summary className="cursor-pointer font-semibold text-azul underline decoration-dotted">Como foi calculado?</summary>
      <div className="mt-1 rounded-lg bg-[#DDEBF7] p-2 text-tinta">{children}</div>
    </details>
  );
}

export function Voltar({ href, texto }: { href: string; texto: string }) {
  return <Link href={href} className="text-sm font-semibold text-azul hover:underline">← {texto}</Link>;
}

export function EmBreve({ fase }: { fase: number }) {
  return <span className="etiqueta bg-bege text-cinza">Fase {fase}</span>;
}

export function tamanho(bytes: number) {
  if (bytes > 1048576) return (bytes / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}
