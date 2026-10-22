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

/** 叠在图上的效果：打圈 = 会翻/拧，箭头 = 去哪里，蓝框 = 认它要看的贴纸 */
export interface Overlay {
  spins?: Vec[];
  arrows?: { from: Vec; to: Vec }[];
  cues?: { pos: Vec; face: Face }[];
}

export function stateDiagram(s: CubeState, mode: DiagramMode, overlay?: Overlay, only?: (pos: Vec) => boolean): SVGSVGElement {
  const top = s.centerColor('U');
  const paint = (c: Color | null, pos?: Vec) =>
    !c ? GREY : only ? (pos && (only(pos) || (pos[0] === 0 && pos[2] === 0)) ? FILL[c] : GREY) : mode === 'pll' ? FILL[c] : c === top ? FILL[c] : GREY;
  const isCorner = (pos: Vec) => pos[0] !== 0 && pos[2] !== 0;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.classList.add('diagram');
  const boxes = new Map<string, [number, number, number, number]>();
  const rect = (x: number, y: number, w: number, hgt: number, fill: string, ignore = false, at?: string) => {
    if (at) boxes.set(at, [x, y, w, hgt]);
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
      rect(o + c * cell, o + r * cell, cell, cell, paint(s.colorAt(pos, 'U'), pos), skip(pos), `${pos}:U`);
    }
  const strip = (face: Face, pos: Vec, x: number, y: number, w: number, hgt: number) => rect(x, y, w, hgt, paint(s.colorAt(pos, face), pos), skip(pos), `${pos}:${face}`);
  for (let i = 0; i < 3; i++) {
    strip('B', [i - 1, 1, -1], o + i * cell + 2, o - side - 2, cell - 4, side);
    strip('F', [i - 1, 1, 1], o + i * cell + 2, o + 3 * cell + 2, cell - 4, side);
    strip('L', [-1, 1, i - 1], o - side - 2, o + i * cell + 2, side, cell - 4);
    strip('R', [1, 1, i - 1], o + 3 * cell + 2, o + i * cell + 2, side, cell - 4);
  }
  if (overlay) drawOverlay(svg, overlay, boxes, (p) => [o + (p[0] + 1) * cell + cell / 2, o + (p[2] + 1) * cell + cell / 2]);
  return svg;
}

const BLUE = '#1b4fb8';

/**
 * 好朋友回家的俯视图：只给这一对好朋友上色（全彩模式下全部上色，要自己找），
 * 角上的小方块是它们的家，两半涂成家两边的颜色。
 */
export function pairDiagram(s: CubeState, slot: string, full = false): SVGSVGElement {
  const ids = [`D${slot}`, slot];
  const svg = stateDiagram(s, 'pll', undefined, full ? () => true : (pos) => ids.includes(s.at(pos).id));
  const ns = 'http://www.w3.org/2000/svg';
  const xFace = slot[1] as Face;
  const zFace = slot[0] as Face;
  const sx = xFace === 'R' ? 1 : -1;
  const sz = zFace === 'F' ? 1 : -1;
  const c = 6.5;
  const cx = 50 + sx * 41;
  const cy = 50 + sz * 41;
  // 朝里的那个角（挨着两条侧边）和朝外的角
  const inner = [cx - sx * c, cy - sz * c];
  const outer = [cx + sx * c, cy + sz * c];
  const tri = (third: number[], color: Color) => {
    const t = document.createElementNS(ns, 'polygon');
    t.setAttribute('points', [inner, outer, third].map((p) => p.join(',')).join(' '));
    t.setAttribute('fill', FILL[color]);
    svg.append(t);
  };
  // 靠着右/左侧边的一半涂右/左的颜色，靠着前/后侧边的一半涂前/后的颜色
  tri([outer[0], inner[1]], s.centerColor(xFace));
  tri([inner[0], outer[1]], s.centerColor(zFace));
  const box = document.createElementNS(ns, 'rect');
  for (const [k, v] of Object.entries({ x: cx - c, y: cy - c, width: 2 * c, height: 2 * c, rx: 2.5, fill: 'none', stroke: BLUE, 'stroke-width': 1.8, 'stroke-dasharray': '3 2' })) box.setAttribute(k, String(v));
  svg.append(box);
  return svg;
}

function drawOverlay(svg: SVGSVGElement, ov: Overlay, boxes: Map<string, [number, number, number, number]>, center: (p: Vec) => [number, number]): void {
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    svg.append(e);
    return e;
  };
  // 箭头头
  const id = `ah${Math.random().toString(36).slice(2, 8)}`;
  const defs = el('defs', {});
  const marker = document.createElementNS(ns, 'marker');
  for (const [k, v] of Object.entries({ id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto-start-reverse' })) marker.setAttribute(k, String(v));
  const head = document.createElementNS(ns, 'path');
  head.setAttribute('d', 'M0 0L10 5L0 10z');
  head.setAttribute('fill', BLUE);
  marker.append(head);
  defs.append(marker);

  for (const c of ov.cues ?? []) {
    const b = boxes.get(`${c.pos}:${c.face}`);
    if (b) el('rect', { x: b[0] - 1.2, y: b[1] - 1.2, width: b[2] + 2.4, height: b[3] + 2.4, rx: 3.5, fill: 'none', stroke: BLUE, 'stroke-width': 2.6 });
  }
  for (const p of ov.spins ?? []) {
    const [x, y] = center(p);
    // 一个转圈的箭头：这块会翻/拧
    el('path', { d: `M${x + 5.5} ${y - 2.5}A6 6 0 1 0 ${x + 4} ${y + 4.2}`, fill: 'none', stroke: BLUE, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'marker-start': `url(#${id})` });
  }
  const arrows = ov.arrows ?? [];
  const has = (a: Vec, b: Vec) => arrows.some((m) => `${m.from}` === `${a}` && `${m.to}` === `${b}`);
  for (const m of arrows) {
    const swap = has(m.to, m.from);
    // 两块互换只画一条双头箭头
    if (swap && `${m.from}` > `${m.to}`) continue;
    const [x1, y1] = center(m.from);
    const [x2, y2] = center(m.to);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const pad = 5;
    el('line', {
      x1: x1 + ux * pad,
      y1: y1 + uy * pad,
      x2: x2 - ux * pad,
      y2: y2 - uy * pad,
      stroke: BLUE,
      'stroke-width': 2.2,
      'stroke-linecap': 'round',
      'marker-end': `url(#${id})`,
      ...(swap ? { 'marker-start': `url(#${id})` } : {}),
    });
  }
}

/**
 * 立体小图（看得见上、前、右三面），给好朋友回家用：
 * 只给要看的块（和中心块）上色，其他都是灰的，一眼看出这对好朋友在哪、白色朝哪。
 */
export function isoDiagram(s: CubeState, show: string[], home: Vec[] = []): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-3.2 -3.7 6.4 6.95');
  svg.classList.add('diagram', 'iso');
  const proj = (x: number, y: number, z: number) => `${((x - z) * 0.866).toFixed(3)},${((x + z) * 0.5 - y).toFixed(3)}`;
  const want = new Set(show);
  const homes = new Set(home.map((p) => p.join(',')));
  const outlines: string[] = [];
  const faces: [Face, (a: number, b: number) => [number, number, number], (i: number, j: number) => Vec][] = [
    ['U', (a, b) => [a, 1.5, b], (i, j) => [i, 1, j]],
    ['F', (a, b) => [a, -b, 1.5], (i, j) => [i, -j, 1]],
    ['R', (a, b) => [1.5, -b, -a], (i, j) => [1, -j, -i]],
  ];
  for (const [face, at, posOf] of faces)
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const pos = posOf(i, j);
        const c = s.at(pos);
        const isCenter = pos.filter((v) => v !== 0).length === 1;
        const col = s.colorAt(pos, face);
        const fill = col && (isCenter || want.has(c.id)) ? FILL[col] : GREY;
        const q = 0.46;
        const pts = [
          [i - q, j - q],
          [i + q, j - q],
          [i + q, j + q],
          [i - q, j + q],
        ].map(([a, b]) => proj(...at(a, b)));
        const poly = document.createElementNS(ns, 'polygon');
        poly.setAttribute('points', pts.join(' '));
        poly.setAttribute('fill', fill);
        poly.setAttribute('stroke', '#1d1f24');
        poly.setAttribute('stroke-width', '0.07');
        poly.setAttribute('stroke-linejoin', 'round');
        svg.append(poly);
        if (homes.has(pos.join(','))) outlines.push(pts.join(' '));
      }
  // 后面和左面看不见：把顶层这两面的贴纸平放在顶面外面一圈（和顶面图的侧边条一样）
  for (let k = -1; k <= 1; k++)
    for (const [face, pos, rect] of [
      ['B', [k, 1, -1], [k - 0.42, -2.08, k + 0.42, -1.68]],
      ['L', [-1, 1, k], [-2.08, k - 0.42, -1.68, k + 0.42]],
    ] as [Face, Vec, number[]][]) {
      const col = s.colorAt(pos, face);
      if (!col || !want.has(s.at(pos).id)) continue;
      const [a0, b0, a1, b1] = rect;
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', [proj(a0, 1.5, b0), proj(a1, 1.5, b0), proj(a1, 1.5, b1), proj(a0, 1.5, b1)].join(' '));
      poly.setAttribute('fill', FILL[col]);
      poly.setAttribute('stroke', '#1d1f24');
      poly.setAttribute('stroke-width', '0.07');
      poly.setAttribute('stroke-linejoin', 'round');
      svg.append(poly);
    }
  // 虚线框：好朋友要回的家
  for (const pts of outlines) {
    const o = document.createElementNS(ns, 'polygon');
    o.setAttribute('points', pts);
    o.setAttribute('fill', 'none');
    o.setAttribute('stroke', '#1b4fb8');
    o.setAttribute('stroke-width', '0.12');
    o.setAttribute('stroke-dasharray', '0.22 0.14');
    o.setAttribute('stroke-linejoin', 'round');
    svg.append(o);
  }
  return svg;
}
