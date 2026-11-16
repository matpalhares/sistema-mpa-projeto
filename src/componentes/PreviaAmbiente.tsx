import type { Ambiente, Parede } from "@/lib/pranchas/ambiente";

// Prévia do ambiente lido, para comparar com a planta antes de gerar. Norte (parede de cima da planta) para cima.
export function PreviaAmbiente({ a, tamanho = 230 }: { a: Ambiente; tamanho?: number }) {
  const W = a.largura || 1, H = a.comprimento || 1, t = 0.15, m = 0.35;
  const s = (tamanho - 8) / Math.max(W + 2 * (t + m), H + 2 * (t + m));
  const X = (v: number) => (v + t + m) * s + 4, Y = (v: number) => (v + t + m) * s + 4;
  const ret = (p: Parede, de: number, ate: number, prof: number): [number, number, number, number] =>
    p === "N" ? [de, 0, ate - de, prof] : p === "S" ? [de, H - prof, ate - de, prof] : p === "O" ? [0, de, prof, ate - de] : [W - prof, de, prof, ate - de];
  const pt = (p: Parede, pos: number, d: number): [number, number] => (p === "N" ? [pos, d] : p === "S" ? [pos, H - d] : p === "O" ? [d, pos] : [W - d, pos]);
  const cx = (q: [number, number, number, number]) => ({ x: X(Math.min(q[0], q[0] + q[2])), y: Y(Math.min(q[1], q[1] + q[3])), width: Math.abs(q[2]) * s, height: Math.abs(q[3]) * s });
  const boxL = a.box ? (a.box.parede === "N" || a.box.parede === "S" ? W : H) : 0;
  return (
    <svg width={tamanho} height={(H + 2 * (t + m)) * s + 8} role="img" aria-label={`Desenho lido do ambiente ${a.nome}`} className="rounded-lg bg-white">
      <rect x={X(-t)} y={Y(-t)} width={(W + 2 * t) * s} height={(H + 2 * t) * s} fill="#8C8C8C" />
      <rect x={X(0)} y={Y(0)} width={W * s} height={H * s} fill="#fff" stroke="#1a1a1a" />
      {a.box && <rect {...cx(ret(a.box.parede, 0, boxL, a.box.profundidade))} fill="#EAF2F8" stroke="#2F86C4" strokeDasharray="4 3" />}
      {a.ralo && <rect x={X(a.ralo.x) - 4} y={Y(a.ralo.y) - 4} width={8} height={8} fill="#F28C28" stroke="#1a1a1a" />}
      {a.chuveiro && (() => { const [x, y] = pt(a.chuveiro.parede, a.chuveiro.pos, 0.3); return <circle cx={X(x)} cy={Y(y)} r={0.09 * s} fill="#BDBDBD" stroke="#1a1a1a" />; })()}
      {a.vasos.map((v, i) => <rect key={"v" + i} {...cx(ret(v.parede, v.eixo - 0.19, v.eixo + 0.19, 0.65))} fill="#EFEBE0" stroke="#1a1a1a" rx={0.16 * s} />)}
      {a.bancadas.map((b, i) => (
        <g key={"b" + i}>
          <rect {...cx(ret(b.parede, b.inicio, b.inicio + b.comprimento, b.profundidade))} fill="#E3D3B0" stroke="#1a1a1a" />
          {b.cubas.map((c, k) => { const [x, y] = pt(b.parede, b.inicio + c, b.profundidade / 2); return <rect key={k} x={X(x) - 0.15 * s} y={Y(y) - 0.15 * s} width={0.3 * s} height={0.3 * s} fill="#fff" stroke="#1a1a1a" />; })}
        </g>
      ))}
      {a.porta && (() => {
        const p = a.porta, d0 = p.abre === "dentro" ? 0 : -t, sg = p.abre === "dentro" ? 1 : -1, dob = p.dobradica === "inicio" ? p.inicio : p.inicio + p.largura;
        const [hx, hy] = pt(p.parede, dob, d0), [lx, ly] = pt(p.parede, dob, d0 + sg * p.largura);
        return <g><rect {...cx(ret(p.parede, p.inicio, p.inicio + p.largura, -t))} fill="#fff" stroke="#1a1a1a" /><line x1={X(hx)} y1={Y(hy)} x2={X(lx)} y2={Y(ly)} stroke="#1a1a1a" strokeWidth={2} /></g>;
      })()}
      <text x={X(W / 2)} y={Y(-t) - 5} textAnchor="middle" fontSize={10} fill="#B3261E">{W.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m</text>
      <text x={X(-t) - 4} y={Y(H / 2)} textAnchor="middle" fontSize={10} fill="#B3261E" transform={`rotate(-90 ${X(-t) - 4} ${Y(H / 2)})`}>{H.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m</text>
    </svg>
  );
}
