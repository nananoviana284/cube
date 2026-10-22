import { invertAlg, stateFrom } from '../cube/alg';
import type { Color, CubeState, Face, Vec } from '../cube/model';

const FILL: Record<Color, string> = {
  W: '#ffffff',
  Y: '#ffd500',
  G: '#00b84a',
  B: '#0a5bd8',
  O: '#ff7a00',
  R: '#e0182d',
};
const GREY = '#c9ccd3';

const PALE = '#f1f2f5';

export type DiagramMode = 'oll' | 'pll' | 'edges';

/**
 * 顶层俯视图（3×3 顶面 + 四周侧面一圈），就是公式卡片上常见的那种图。
 * mode 'oll' 只显示黄色，其它灰色；'pll' 显示全部颜色；
 * 'edges' 是黄十字这一步：只看四个棱块，角块画成虚线的"不用管"。
 */
export function topDiagram(alg: string, mode: DiagramMode): SVGSVGElement {
  return stateDiagram(stateFrom(invertAlg(alg)), mode);
}

export function stateDiagram(s: CubeState, mode: DiagramMode): SVGSVGElement {
  const top = s.centerColor('U');
  const paint = (c: Color | null) => (!c ? GREY : mode === 'pll' ? FILL[c] : c === top ? FILL[c] : GREY);
  const isCorner = (pos: Vec) => pos[0] !== 0 && pos[2] !== 0;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.classList.add('diagram');
  const rect = (x: number, y: number, w: number, hgt: number, fill: string, ignore = false) => {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(w));
    r.setAttribute('height', String(hgt));
    r.setAttribute('rx', '2.5');
    r.setAttribute('fill', ignore ? PALE : fill);
    r.setAttribute('stroke', ignore ? '#b7bac4' : '#1d1f24');
    r.setAttribute('stroke-width', '1.6');
    if (ignore) r.setAttribute('stroke-dasharray', '3 2');
    svg.append(r);
  };
  const skip = (pos: Vec) => mode === 'edges' && isCorner(pos);
  const cell = 22;
  const o = 17;
  const side = 9;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const pos: Vec = [c - 1, 1, r - 1];
      rect(o + c * cell, o + r * cell, cell, cell, paint(s.colorAt(pos, 'U')), skip(pos));
    }
  const strip = (face: Face, pos: Vec, x: number, y: number, w: number, hgt: number) => rect(x, y, w, hgt, paint(s.colorAt(pos, face)), skip(pos));
  for (let i = 0; i < 3; i++) {
    strip('B', [i - 1, 1, -1], o + i * cell + 2, o - side - 2, cell - 4, side);
    strip('F', [i - 1, 1, 1], o + i * cell + 2, o + 3 * cell + 2, cell - 4, side);
    strip('L', [-1, 1, i - 1], o - side - 2, o + i * cell + 2, side, cell - 4);
    strip('R', [1, 1, i - 1], o + 3 * cell + 2, o + i * cell + 2, side, cell - 4);
  }
  return svg;
}
