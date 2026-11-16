// Perspectiva isométrica renderizada (axonometria, câmera ortográfica vista de cima).
// Ocultação exata por z-buffer (não usa "algoritmo do pintor", que gera peças atravessadas e sobrepostas).
import sharp from "sharp";

export type V3 = [number, number, number];
export interface Solido {
  min: V3; max: V3;
  cor: V3; // 0 a 255
  pedra?: boolean; // textura procedural de pedra
  semArestas?: boolean;
  alfa?: number; // 0 a 1: translúcido (vidro, espelho), desenhado depois dos opacos
}
export interface Render { png: Buffer; largura: number; altura: number; projetar: (p: V3) => [number, number] }

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };

function ruido(x: number, y: number, z: number) {
  let h = (Math.imul(Math.floor(x), 374761393) + Math.imul(Math.floor(y), 668265263) + Math.imul(Math.floor(z), 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Câmera em +x / -y / +z olhando para a cena, elevação ~38° (padrão das skills do escritório).
export async function renderizar(solidos: Solido[], larguraPx: number, alturaPx: number, o: { azimute?: number; elevacao?: number } = {}): Promise<Render> {
  const SS = 2; // supersampling 2x
  const W = larguraPx * SS, H = alturaPx * SS;
  const az = ((o.azimute ?? -55) * Math.PI) / 180, el = ((o.elevacao ?? 38) * Math.PI) / 180;
  const cam: V3 = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]; // direção da cena para a câmera
  const dir = norm(cross([0, 0, 1], cam)); // direita na tela
  const cima = cross(cam, dir);

  // enquadramento
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of solidos) for (let i = 0; i < 8; i++) {
    const p: V3 = [i & 1 ? s.max[0] : s.min[0], i & 2 ? s.max[1] : s.min[1], i & 4 ? s.max[2] : s.min[2]];
    const sx = dot(p, dir), sy = dot(p, cima);
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  const margem = 0.04;
  const escala = Math.min((W * (1 - 2 * margem)) / (x1 - x0), (H * (1 - 2 * margem)) / (y1 - y0));
  const offX = (W - (x1 - x0) * escala) / 2, offY = (H - (y1 - y0) * escala) / 2;
  const tela = (p: V3): [number, number, number] => [offX + (dot(p, dir) - x0) * escala, H - (offY + (dot(p, cima) - y0) * escala), dot(p, cam)];

  const cor = new Uint8ClampedArray(W * H * 4);
  const zb = new Float32Array(W * H).fill(-Infinity);
  const LUZ: [V3, number][] = [[[0, 0, 1], 1.0], [[1, 0, 0], 0.84], [[0, -1, 0], 0.7], [[-1, 0, 0], 0.62], [[0, 1, 0], 0.62], [[0, 0, -1], 0.5]];

  const triangulo = (a: V3, b: V3, c: V3, s: Solido, luz: number, eixo: number, alfa = 1) => {
    const A = tela(a), B = tela(b), C = tela(c);
    const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (Math.abs(area) < 1e-9) return;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
      const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * A[2] + w1 * B[2] + w2 * C[2];
      const i = y * W + x;
      if (z <= zb[i]) continue;
      if (alfa >= 1) zb[i] = z;
      let f = luz;
      if (s.pedra) {
        // textura por coordenadas do mundo (em metros): grãos finos + manchas maiores
        const wx = w0 * a[0] + w1 * b[0] + w2 * c[0], wy = w0 * a[1] + w1 * b[1] + w2 * c[1], wz = w0 * a[2] + w1 * b[2] + w2 * c[2];
        const u = eixo === 0 ? wy : wx, v = eixo === 2 ? wy : wz;
        const fino = ruido(u * 420, v * 420, eixo), medio = ruido(u * 90, v * 90, eixo + 7);
        f *= 0.9 + 0.14 * medio + (fino > 0.93 ? 0.1 : fino < 0.07 ? -0.16 : 0);
      }
      if (alfa >= 1) { cor[i * 4] = s.cor[0] * f; cor[i * 4 + 1] = s.cor[1] * f; cor[i * 4 + 2] = s.cor[2] * f; cor[i * 4 + 3] = 255; }
      else { for (let k = 0; k < 3; k++) cor[i * 4 + k] = (cor[i * 4 + 3] ? cor[i * 4 + k] : 247) * (1 - alfa) + s.cor[k] * f * alfa; cor[i * 4 + 3] = 255; }
    }
  };

  const faces = (s: Solido) => {
    const [a, b] = [s.min, s.max];
    const P = (i: number): V3 => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]];
    return [
      { n: [0, 0, 1] as V3, q: [4, 5, 7, 6], eixo: 2 }, { n: [0, 0, -1] as V3, q: [0, 2, 3, 1], eixo: 2 },
      { n: [1, 0, 0] as V3, q: [1, 3, 7, 5], eixo: 0 }, { n: [-1, 0, 0] as V3, q: [0, 4, 6, 2], eixo: 0 },
      { n: [0, -1, 0] as V3, q: [0, 1, 5, 4], eixo: 1 }, { n: [0, 1, 0] as V3, q: [2, 6, 7, 3], eixo: 1 },
    ].filter((f) => dot(f.n, cam) > 1e-6).map((f) => ({ ...f, p: f.q.map(P) }));
  };

  const opacos = solidos.filter((s) => s.alfa == null || s.alfa >= 1), vidros = solidos.filter((s) => s.alfa != null && s.alfa < 1);
  for (const s of opacos) for (const f of faces(s)) {
    const luz = LUZ.find(([n]) => dot(n, f.n) > 0.99)![1];
    triangulo(f.p[0], f.p[1], f.p[2], s, luz, f.eixo);
    triangulo(f.p[0], f.p[2], f.p[3], s, luz, f.eixo);
  }
  // arestas com teste de profundidade
  const eps = 0.004;
  const arestas = (lista: Solido[]) => { for (const s of lista) {
    if (s.semArestas) continue;
    for (const f of faces(s)) for (let k = 0; k < 4; k++) {
      const A = tela(f.p[k]), B = tela(f.p[(k + 1) % 4]);
      const n = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]));
      for (let t = 0; t <= n; t++) {
        const r = n ? t / n : 0, x = Math.round(A[0] + (B[0] - A[0]) * r), y = Math.round(A[1] + (B[1] - A[1]) * r), z = A[2] + (B[2] - A[2]) * r;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const i = Y * W + X;
          if (z < zb[i] - eps) continue;
          cor[i * 4] = 45; cor[i * 4 + 1] = 45; cor[i * 4 + 2] = 50; cor[i * 4 + 3] = 255;
        }
      }
    }
  } };
  arestas(opacos);
  // translúcidos: só a face mais próxima de cada sólido, misturada sobre o que já está desenhado
  for (const s of vidros) for (const f of faces(s)) {
    const luz = LUZ.find(([n]) => dot(n, f.n) > 0.99)![1];
    triangulo(f.p[0], f.p[1], f.p[2], s, luz, f.eixo, s.alfa);
    triangulo(f.p[0], f.p[2], f.p[3], s, luz, f.eixo, s.alfa);
  }
  arestas(vidros);
  const png = await sharp(Buffer.from(cor.buffer), { raw: { width: W, height: H, channels: 4 } }).resize(larguraPx, alturaPx, { kernel: "lanczos3" }).png().toBuffer();
  return { png, largura: larguraPx, altura: alturaPx, projetar: (p) => { const [x, y] = tela(p); return [x / W, y / H]; } };
}
