import { ETAPAS } from "@/lib/etapas";

// Barra de etapas do projeto. Com "acao", cada etapa vira um botão para marcar onde o projeto está.
export function BarraEtapas({ atual, id, acao }: { atual: number; id?: string; acao?: (f: FormData) => Promise<void> }) {
  const pct = Math.round((Math.min(atual, ETAPAS.length) / ETAPAS.length) * 100);
  if (!acao) {
    return (
      <div>
        <div className="mb-1 flex justify-between text-xs text-cinza">
          <span>{atual >= ETAPAS.length ? "Concluído" : `Etapa ${atual + 1} de ${ETAPAS.length}: ${ETAPAS[atual]}`}</span><span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bege"><div className="h-full rounded-full bg-dourado" style={{ width: pct + "%" }} /></div>
      </div>
    );
  }
  return (
    <form action={acao} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={id} />
      {ETAPAS.map((e, i) => (
        <button key={i} name="etapa" value={i} title="Marcar como etapa atual"
          className={"rounded-xl border px-3 py-2 text-left text-xs font-semibold transition " + (i < atual ? "border-verde/40 bg-verde/10 text-verde" : i === atual ? "border-azul bg-azul text-white" : "border-begelinha bg-white text-cinza hover:border-azul")}>
          <span className="block text-[10px] opacity-70">{i < atual ? "✓ feita" : i === atual ? "agora" : `etapa ${i + 1}`}</span>{e}
        </button>
      ))}
      <button name="etapa" value={ETAPAS.length} className={"rounded-xl border px-3 py-2 text-xs font-semibold " + (atual >= ETAPAS.length ? "border-verde bg-verde text-white" : "border-begelinha bg-white text-cinza hover:border-verde")}>✓ Concluir tudo</button>
    </form>
  );
}
