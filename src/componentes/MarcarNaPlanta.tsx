"use client";
import { useRef, useState } from "react";
import type { Ambiente, BancadaAmb, Parede } from "@/lib/pranchas/ambiente";

// Recorte da planta enviada com o ambiente lido por cima. O usuário marca vaso, bancada, cubas, box, chuveiro, ralo e porta
// clicando em cima do desenho: as posições e medidas saem do clique, sem digitar.
type Ferramenta = "vaso" | "bancada" | "cuba" | "chuveiro" | "ralo" | "box" | "porta";
const FERRAMENTAS: { id: Ferramenta; nome: string; passos: string[] }[] = [
  { id: "vaso", nome: "Vaso", passos: ["Clique no centro do vaso."] },
  { id: "bancada", nome: "Bancada", passos: ["Clique em um canto da bancada.", "Agora clique no canto oposto (na diagonal)."] },
  { id: "cuba", nome: "Cuba", passos: ["Clique no centro da cuba, em cima de uma bancada já marcada."] },
  { id: "chuveiro", nome: "Chuveiro", passos: ["Clique no ponto do chuveiro."] },
  { id: "ralo", nome: "Ralo", passos: ["Clique no ralo."] },
  { id: "box", nome: "Box", passos: ["Clique em uma ponta da linha do vidro do box.", "Agora clique na outra ponta da linha do vidro."] },
  { id: "porta", nome: "Porta", passos: ["Clique em um lado do vão da porta.", "Agora clique no outro lado do vão."] },
];
const cm = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => v.toFixed(2).replace(".", ",");
const NOME: Record<Parede, string> = { N: "de cima", S: "de baixo", O: "da esquerda", L: "da direita" };

const Chip = ({ texto, tirar }: { texto: string; tirar: () => void }) => <span className="inline-flex items-center gap-1 rounded-full bg-bege px-2 py-0.5 text-xs">{texto}<button type="button" className="font-bold text-vermelho" aria-label={`Tirar ${texto}`} onClick={tirar}>×</button></span>;

export function MarcarNaPlanta({ a, aoMudar }: { a: Ambiente; aoMudar: (patch: Partial<Ambiente>) => void }) {
  const rec = a.recorte!;
  const [ferramenta, setFerramenta] = useState<Ferramenta | null>(null);
  const [primeiro, setPrimeiro] = useState<[number, number] | null>(null);
  const [aviso, setAviso] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const W = a.largura, H = a.comprimento;
  // a imagem foi recortada pelo traço; se a medida do ambiente foi corrigida, o desenho por cima acompanha
  const sx = rec.pxPorM, sy = rec.pxPorM;
  const X = (m: number) => rec.x0 + m * sx, Y = (m: number) => rec.y0 + m * sy;
  const limitar = (v: number, max: number) => Math.min(max, Math.max(0, v));

  const paredeMaisPerto = (x: number, y: number): Parede => { const d: [Parede, number][] = [["N", y], ["S", H - y], ["O", x], ["L", W - x]]; return d.sort((p, q) => p[1] - q[1])[0][0]; };
  const aoLongo = (p: Parede, x: number, y: number) => (p === "N" || p === "S" ? x : y);
  const escolher = (f: Ferramenta) => { setFerramenta(ferramenta === f ? null : f); setPrimeiro(null); setAviso(""); };

  const clicar = (e: React.MouseEvent) => {
    if (!ferramenta || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) * rec.largura) / r.width, py = ((e.clientY - r.top) * rec.altura) / r.height;
    const x = limitar((px - rec.x0) / sx, W), y = limitar((py - rec.y0) / sy, H);
    setAviso("");
    if (ferramenta === "vaso") { const p = paredeMaisPerto(x, y); aoMudar({ vasos: [...a.vasos, { parede: p, eixo: cm(aoLongo(p, x, y)) }] }); setFerramenta(null); return; }
    if (ferramenta === "chuveiro") { const p = paredeMaisPerto(x, y); aoMudar({ chuveiro: { parede: p, pos: cm(aoLongo(p, x, y)), registros: a.chuveiro?.registros ?? 1 } }); setFerramenta(null); return; }
    if (ferramenta === "ralo") { aoMudar({ ralo: { x: cm(x), y: cm(y) } }); setFerramenta(null); return; }
    if (ferramenta === "cuba") {
      const k = a.bancadas.findIndex((b) => { const [bx, by, bw, bh] = retBancada(b); return x >= bx - 0.03 && x <= bx + bw + 0.03 && y >= by - 0.03 && y <= by + bh + 0.03; });
      if (k < 0) { setAviso("Clique em cima de uma bancada já marcada. Se ainda não marcou a bancada, marque ela primeiro."); return; }
      const b = a.bancadas[k], eixo = cm(aoLongo(b.parede, x, y) - b.inicio);
      aoMudar({ bancadas: a.bancadas.map((o, n) => (n === k ? { ...o, cubas: [...o.cubas, eixo].sort((p, q) => p - q) } : o)) }); return; // continua na ferramenta: pode haver várias cubas
    }
    if (!primeiro) { setPrimeiro([x, y]); return; }
    const [x0, y0] = primeiro; setPrimeiro(null);
    if (ferramenta === "bancada") {
      const gruda = (v: number, max: number) => (v < 0.04 ? 0 : v > max - 0.04 ? max : v);
      const xa = gruda(Math.min(x0, x), W), xb = gruda(Math.max(x0, x), W), ya = gruda(Math.min(y0, y), H), yb = gruda(Math.max(y0, y), H);
      if (xb - xa < 0.15 || yb - ya < 0.15) { setAviso("A bancada ficou pequena demais. Clique nos dois cantos opostos da bancada."); return; }
      const deitada = xb - xa >= yb - ya; // lado maior na horizontal: encosta na parede de cima ou de baixo
      const parede: Parede = deitada ? (ya <= H - yb ? "N" : "S") : xa <= W - xb ? "O" : "L";
      const nova: BancadaAmb = deitada ? { parede, inicio: cm(xa), comprimento: cm(xb - xa), profundidade: cm(parede === "N" ? yb : H - ya), cubas: [] } : { parede, inicio: cm(ya), comprimento: cm(yb - ya), profundidade: cm(parede === "O" ? xb : W - xa), cubas: [] };
      aoMudar({ bancadas: [...a.bancadas, nova] }); setFerramenta("cuba"); return; // em seguida, as cubas
    }
    if (ferramenta === "box") {
      const horizontal = Math.abs(x - x0) >= Math.abs(y - y0), meio = horizontal ? (y + y0) / 2 : (x + x0) / 2;
      const parede: Parede = horizontal ? (meio <= H / 2 ? "N" : "S") : meio <= W / 2 ? "O" : "L";
      aoMudar({ box: { parede, profundidade: cm(parede === "N" || parede === "O" ? meio : (horizontal ? H : W) - meio) } }); setFerramenta(null); return;
    }
    if (ferramenta === "porta") {
      const p = paredeMaisPerto((x + x0) / 2, (y + y0) / 2), de = Math.min(aoLongo(p, x0, y0), aoLongo(p, x, y)), ate = Math.max(aoLongo(p, x0, y0), aoLongo(p, x, y));
      if (ate - de < 0.4) { setAviso("O vão ficou estreito demais. Clique nos dois lados do vão da porta."); return; }
      aoMudar({ porta: { parede: p, inicio: cm(de), largura: cm(ate - de), altura: a.porta?.altura ?? 2.1, abre: a.porta?.abre ?? "dentro", dobradica: a.porta?.dobradica ?? "inicio" } }); setFerramenta(null);
    }
  };

  function retBancada(b: BancadaAmb): [number, number, number, number] { return ret(b.parede, b.inicio, b.inicio + b.comprimento, b.profundidade); }
  function ret(p: Parede, de: number, ate: number, prof: number): [number, number, number, number] { return p === "N" ? [de, 0, ate - de, prof] : p === "S" ? [de, H - prof, ate - de, prof] : p === "O" ? [0, de, prof, ate - de] : [W - prof, de, prof, ate - de]; }
  const pt = (p: Parede, pos: number, d: number): [number, number] => (p === "N" ? [pos, d] : p === "S" ? [pos, H - d] : p === "O" ? [d, pos] : [W - d, pos]);
  const cx = (q: [number, number, number, number]) => ({ x: X(q[0]), y: Y(q[1]), width: q[2] * sx, height: q[3] * sy });
  const passo = ferramenta ? FERRAMENTAS.find((f) => f.id === ferramenta)!.passos[primeiro ? 1 : 0] : "";
  const boxL = a.box ? (a.box.parede === "N" || a.box.parede === "S" ? W : H) : 0;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-azul">Marque as peças clicando em cima da planta</p>
      <div className="flex flex-wrap gap-1.5">
        {FERRAMENTAS.map((f) => <button type="button" key={f.id} className={"opcao px-2.5 py-1 text-xs " + (ferramenta === f.id ? "opcao-ativa" : "")} onClick={() => escolher(f.id)}>+ {f.nome}</button>)}
      </div>
      <p className={"min-h-5 text-xs " + (aviso ? "text-vermelho" : ferramenta ? "font-semibold text-azul" : "text-cinza")} role="status">{aviso || passo || "Escolha uma peça acima e clique no lugar dela no desenho. O contorno azul é o ambiente que o sistema leu."}</p>
      <div className="relative inline-block max-w-full overflow-hidden rounded-lg border border-begelinha bg-white" style={{ width: rec.largura }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/arquivo?c=${encodeURIComponent(rec.imagem)}&ver=1`} alt={`Recorte da planta: ${a.nome}`} width={rec.largura} height={rec.altura} className="block h-auto w-full" />
        <svg ref={svg} viewBox={`0 0 ${rec.largura} ${rec.altura}`} className={"absolute inset-0 h-full w-full " + (ferramenta ? "cursor-crosshair" : "")} onClick={clicar} role="img" aria-label={`Marcar peças em ${a.nome}`}>
          <rect x={X(0)} y={Y(0)} width={W * sx} height={H * sy} fill="none" stroke="#0D2F63" strokeWidth={2.5} strokeDasharray="8 5" />
          {a.box && <rect {...cx(ret(a.box.parede, 0, boxL, a.box.profundidade))} fill="#2F86C4" fillOpacity={0.18} stroke="#2F86C4" strokeWidth={2} />}
          {a.bancadas.map((b, i) => (
            <g key={"b" + i}>
              <rect {...cx(retBancada(b))} fill="#C79B63" fillOpacity={0.35} stroke="#C79B63" strokeWidth={2.5} />
              {b.cubas.map((c, k) => { const [x, y] = pt(b.parede, b.inicio + c, b.profundidade / 2); return <circle key={k} cx={X(x)} cy={Y(y)} r={9} fill="#0D2F63" fillOpacity={0.75} stroke="#fff" strokeWidth={2} />; })}
            </g>
          ))}
          {a.vasos.map((v, i) => { const [x, y] = pt(v.parede, v.eixo, 0.3); return <g key={"v" + i}><circle cx={X(x)} cy={Y(y)} r={13} fill="#0D2F63" fillOpacity={0.8} stroke="#fff" strokeWidth={2.5} /><text x={X(x)} y={Y(y) + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">V</text></g>; })}
          {a.chuveiro && (() => { const [x, y] = pt(a.chuveiro.parede, a.chuveiro.pos, 0.12); return <circle cx={X(x)} cy={Y(y)} r={9} fill="#2F86C4" fillOpacity={0.5} stroke="#2F86C4" strokeWidth={2.5} />; })()}
          {a.ralo && <rect x={X(a.ralo.x) - 7} y={Y(a.ralo.y) - 7} width={14} height={14} fill="#F28C28" fillOpacity={0.6} stroke="#F28C28" strokeWidth={2} />}
          {a.porta && (() => { const p = a.porta, t = a.espessuraParede; const q = ret(p.parede, p.inicio, p.inicio + p.largura, 0.001); const g = p.parede === "N" ? { x: X(q[0]), y: Y(-t), width: q[2] * sx, height: t * sy } : p.parede === "S" ? { x: X(q[0]), y: Y(H), width: q[2] * sx, height: t * sy } : p.parede === "O" ? { x: X(-t), y: Y(q[1]), width: t * sx, height: q[3] * sy } : { x: X(W), y: Y(q[1]), width: t * sx, height: q[3] * sy }; return <rect {...g} fill="#1E8E3E" fillOpacity={0.35} stroke="#1E8E3E" strokeWidth={2.5} />; })()}
          {primeiro && <circle cx={X(primeiro[0])} cy={Y(primeiro[1])} r={6} fill="#0D2F63" />}
        </svg>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {a.porta && <Chip texto={`Porta ${fmt(a.porta.largura)} m, parede ${NOME[a.porta.parede]}`} tirar={() => aoMudar({ porta: null })} />}
        {a.vasos.map((v, i) => <Chip key={"v" + i} texto={`Vaso na parede ${NOME[v.parede]}, eixo a ${fmt(v.eixo)} m`} tirar={() => aoMudar({ vasos: a.vasos.filter((_, n) => n !== i) })} />)}
        {a.bancadas.map((b, i) => <Chip key={"b" + i} texto={`Bancada ${fmt(b.comprimento)} x ${fmt(b.profundidade)} m, ${b.cubas.length} cuba(s)`} tirar={() => aoMudar({ bancadas: a.bancadas.filter((_, n) => n !== i) })} />)}
        {a.box && <Chip texto={`Box com ${fmt(a.box.profundidade)} m`} tirar={() => aoMudar({ box: null })} />}
        {a.chuveiro && <Chip texto="Chuveiro" tirar={() => aoMudar({ chuveiro: null })} />}
        {a.ralo && <Chip texto="Ralo" tirar={() => aoMudar({ ralo: null })} />}
      </div>
      {a.porta && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-cinza">A porta abre para:</span>
          {(["dentro", "fora"] as const).map((v) => <button type="button" key={v} className={"opcao px-2 py-0.5 text-xs " + (a.porta!.abre === v ? "opcao-ativa" : "")} onClick={() => aoMudar({ porta: { ...a.porta!, abre: v } })}>{v}</button>)}
          <span className="ml-2 text-cinza">Dobradiça:</span>
          {(["inicio", "fim"] as const).map((v) => <button type="button" key={v} className={"opcao px-2 py-0.5 text-xs " + (a.porta!.dobradica === v ? "opcao-ativa" : "")} onClick={() => aoMudar({ porta: { ...a.porta!, dobradica: v } })}>{a.porta!.parede === "N" || a.porta!.parede === "S" ? (v === "inicio" ? "à esquerda" : "à direita") : v === "inicio" ? "em cima" : "embaixo"}</button>)}
        </div>
      )}
      {a.chuveiro && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-cinza">Registros do chuveiro:</span>
          {([1, 2] as const).map((v) => <button type="button" key={v} className={"opcao px-2 py-0.5 text-xs " + (a.chuveiro!.registros === v ? "opcao-ativa" : "")} onClick={() => aoMudar({ chuveiro: { ...a.chuveiro!, registros: v } })}>{v === 1 ? "1 (só fria)" : "2 (quente e fria)"}</button>)}
        </div>
      )}
    </div>
  );
}
