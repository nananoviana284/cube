import { invertAlg, stateFrom } from '../cube/alg';
import type { Color, Face, Vec } from '../cube/model';

const FILL: Record<Color, string> = {
  W: '#ffffff',
  Y: '#ffd500',
  G: '#00b84a',
  B: '#0a5bd8',
  O: '#ff7a00',
  R: '#e0182d',
};
const GREY = '#c9ccd3';

/**
 * 顶层俯视图（3×3 顶面 + 四周侧面一圈），就是公式卡片上常见的那种图。
 * mode 'oll' 只显示黄色，其它灰色；'pll' 显示全部颜色。
 */
export function topDiagram(alg: string, mode: 'oll' | 'pll'): SVGSVGElement {
  const s = stateFrom(invertAlg(alg));
  const top = s.centerColor('U');
  const paint = (c: Color | null) => (!c ? GREY : mode === 'oll' ? (c === top ? FILL[c] : GREY) : FILL[c]);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.classList.add('diagram');
  const rect = (x: number, y: number, w: number, hgt: number, fill: string) => {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', String(x));
    r.setAttribute('y', String(y));
    r.setAttribute('width', String(w));
    r.setAttribute('height', String(hgt));
    r.setAttribute('rx', '2.5');
    r.setAttribute('fill', fill);
    r.setAttribute('stroke', '#1d1f24');
    r.setAttribute('stroke-width', '1.6');
    svg.append(r);
  };
  const cell = 22;
  const o = 17;
  const side = 9;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const pos: Vec = [c - 1, 1, r - 1];
      rect(o + c * cell, o + r * cell, cell, cell, paint(s.colorAt(pos, 'U')));
    }
  const strip = (face: Face, pos: Vec, x: number, y: number, w: number, hgt: number) => rect(x, y, w, hgt, paint(s.colorAt(pos, face)));
  for (let i = 0; i < 3; i++) {
    strip('B', [i - 1, 1, -1], o + i * cell + 2, o - side - 2, cell - 4, side);
    strip('F', [i - 1, 1, 1], o + i * cell + 2, o + 3 * cell + 2, cell - 4, side);
    strip('L', [-1, 1, i - 1], o - side - 2, o + i * cell + 2, side, cell - 4);
    strip('R', [1, 1, i - 1], o + 3 * cell + 2, o + i * cell + 2, side, cell - 4);
  }
  return svg;
}
