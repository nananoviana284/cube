import { invertAlg, stateFrom } from '../cube/alg';
import { FACE_NORMAL, type CubeState, type Face, type Vec } from '../cube/model';

// 一个顶层公式"做了什么"：从它的情况出发，哪些块会翻上来、哪些块会换到哪里去。
// 全部用魔方模型算出来，不手写，所以图和话永远和公式对得上。

export type Mode = 'oll' | 'pll' | 'edges';

export const POS_NAME: Record<string, string> = {
  '0,1,1': '前',
  '1,1,0': '右',
  '0,1,-1': '后',
  '-1,1,0': '左',
  '1,1,1': '右前',
  '-1,1,1': '左前',
  '1,1,-1': '右后',
  '-1,1,-1': '左后',
};
const key = (p: Vec) => p.join(',');
export const posName = (p: Vec) => POS_NAME[key(p)];
const isCorner = (p: Vec) => p[0] !== 0 && p[2] !== 0;
const TOP_POS: Vec[] = Object.keys(POS_NAME).map((k) => k.split(',').map(Number) as Vec);
const SIDES: Face[] = ['F', 'R', 'B', 'L'];

export interface Effect {
  /** 黄色还没朝上、做完会翻上来的棱块位置 */
  flips: Vec[];
  /** 黄色还没朝上、做完会拧正的角块位置 */
  twists: Vec[];
  /** 会换位置的块：从哪到哪 */
  moves: { from: Vec; to: Vec }[];
  /** 认出这个情况要看的贴纸：位置 + 朝哪面 */
  cues: { pos: Vec; face: Face }[];
}

export function effectOf(s: CubeState, mode: Mode): Effect {
  const top = s.centerColor('U');
  const yellowUp = (p: Vec) => s.colorAt(p, 'U') === top;
  const tops = TOP_POS.filter((p) => mode !== 'edges' || !isCorner(p));
  const flips = mode === 'pll' ? [] : tops.filter((p) => !isCorner(p) && !yellowUp(p));
  const twists = mode === 'oll' ? tops.filter((p) => isCorner(p) && !yellowUp(p)) : [];
  const moves =
    mode === 'pll'
      ? tops
          .map((p) => ({ from: p, to: s.at(p).home }))
          .filter((m) => key(m.from) !== key(m.to))
      : [];
  const cues: Effect['cues'] = [];
  if (mode === 'edges') for (const p of tops) if (yellowUp(p)) cues.push({ pos: p, face: 'U' });
  if (mode === 'oll')
    for (const p of TOP_POS.filter(isCorner))
      for (const f of SIDES) if (dot(p, f) && s.colorAt(p, f) === top) cues.push({ pos: p, face: f });
  if (mode === 'pll')
    // 车灯：同一个侧面上两个角颜色一样
    for (const f of SIDES) {
      const corners = TOP_POS.filter((p) => isCorner(p) && dot(p, f));
      const [a, b] = corners.map((p) => s.colorAt(p, f));
      if (a && a === b) for (const p of corners) cues.push({ pos: p, face: f });
    }
  return { flips, twists, moves, cues };
}

const dot = (p: Vec, f: Face) => {
  const n = FACE_NORMAL[f];
  return p[0] * n[0] + p[1] * n[1] + p[2] * n[2] === 1;
};

/** 把"谁到哪"整理成一圈一圈：前 → 左 → 右 → 前，或 前 ↔ 后 */
export function cycles(moves: Effect['moves']): Vec[][] {
  const next = new Map(moves.map((m) => [key(m.from), m.to]));
  const seen = new Set<string>();
  const out: Vec[][] = [];
  for (const m of moves) {
    if (seen.has(key(m.from))) continue;
    const cyc: Vec[] = [];
    let p: Vec | undefined = m.from;
    while (p && !seen.has(key(p))) {
      seen.add(key(p));
      cyc.push(p);
      p = next.get(key(p));
    }
    out.push(cyc);
  }
  return out;
}

/** 一句话说这个公式做了什么 */
export function effectText(e: Effect, mode: Mode): string {
  if (mode === 'pll') {
    const parts = cycles(e.moves).map((c) => {
      const kind = isCorner(c[0]) ? '角' : '棱';
      const names = c.map(posName);
      return c.length === 2 ? `${names[0]}和${names[1]}两个${kind}交换` : `${names.join(' → ')} → ${names[0]}，${c.length} 个${kind}转一圈`;
    });
    return `箭头是每块要去的地方：${parts.join('；')}。黄色面不变。`;
  }
  const parts: string[] = [];
  if (e.flips.length) parts.push(`把${e.flips.map(posName).join('、')} ${e.flips.length} 个棱块翻上来`);
  if (e.twists.length) parts.push(`把${e.twists.map(posName).join('、')} ${e.twists.length} 个角块拧正`);
  const rest = mode === 'edges' ? '角块先不管' : '已经朝上的还是朝上';
  return parts.length ? `${parts.join('，')}（打圈的就是）。${rest}。` : '顶面已经是黄的了。';
}

export interface Angle {
  /** 先拨这一下再做公式（'' = 不用拨） */
  pre: string;
  state: CubeState;
}

/** 同一个情况的 4 个角度，去掉看起来一样的；每个角度先拨几下才能做公式 */
export function anglesOf(alg: string, mode: Mode): Angle[] {
  const out: Angle[] = [];
  const seen = new Set<string>();
  for (const a of ['', 'U', 'U2', "U'"]) {
    const state = stateFrom(`${invertAlg(alg)} ${a}`.trim());
    const sig = signature(state, mode);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ pre: a ? invertAlg(a) : '', state });
  }
  return out;
}

/** 这一步"看得见、要看"的样子：OLL 只看黄不黄，PLL 看全部颜色 */
export function signature(s: CubeState, mode: Mode): string {
  const top = s.centerColor('U');
  const parts: string[] = [];
  for (const p of TOP_POS) {
    if (mode === 'edges' && isCorner(p)) continue;
    for (const f of ['U', ...SIDES] as Face[]) {
      if (f !== 'U' && !dot(p, f)) continue;
      const c = s.colorAt(p, f);
      parts.push(mode === 'pll' ? String(c) : c === top ? 'Y' : '.');
    }
  }
  return parts.join('');
}
