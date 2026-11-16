"use client";
export function SeletorEmpresa({ acao, atual, empresas }: { acao: (f: FormData) => Promise<void>; atual: string; empresas: { id: string; sigla: string; definida: boolean }[] }) {
  return (
    <form action={acao}>
      <label className="flex items-center gap-2 text-xs font-semibold uppercase text-cinza">
        Empresa
        <select name="empresa" defaultValue={atual} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="campo w-auto py-1.5 font-semibold text-azul">
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.sigla}{e.definida ? "" : " (marca a definir)"}</option>)}
        </select>
      </label>
    </form>
  );
}
