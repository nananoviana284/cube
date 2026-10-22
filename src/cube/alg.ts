import type { Turn } from './model';
import { CubeState } from './model';

// 公式解析：支持 R U F L D B、M E S、x y z、小写宽层 r u f l d b，以及 ' 和 2

export interface Move {
  /** 显示用的文字，如 R' */
  text: string;
  turn: Turn;
}

interface MoveDef {
  axis: 0 | 1 | 2;
  layers: number[];
  /** 顺时针一次对应的右手定则 quarter 数 */
  dir: 1 | -1;
}

const DEFS: Record<string, MoveDef> = {
  R: { axis: 0, layers: [1], dir: -1 },
  L: { axis: 0, layers: [-1], dir: 1 },
  U: { axis: 1, layers: [1], dir: -1 },
  D: { axis: 1, layers: [-1], dir: 1 },
  F: { axis: 2, layers: [1], dir: -1 },
  B: { axis: 2, layers: [-1], dir: 1 },
  M: { axis: 0, layers: [0], dir: 1 },
  E: { axis: 1, layers: [0], dir: 1 },
  S: { axis: 2, layers: [0], dir: -1 },
  x: { axis: 0, layers: [-1, 0, 1], dir: -1 },
  y: { axis: 1, layers: [-1, 0, 1], dir: -1 },
  z: { axis: 2, layers: [-1, 0, 1], dir: -1 },
  r: { axis: 0, layers: [0, 1], dir: -1 },
  l: { axis: 0, layers: [-1, 0], dir: 1 },
  u: { axis: 1, layers: [0, 1], dir: -1 },
  d: { axis: 1, layers: [-1, 0], dir: 1 },
  f: { axis: 2, layers: [0, 1], dir: -1 },
  b: { axis: 2, layers: [-1, 0], dir: 1 },
};

export function parseMove(token: string): Move {
  const m = /^([RLUDFBMESxyzrludfb])(w?)(2?)('?)(2?)$/.exec(token);
  if (!m) throw new Error('看不懂的转动: ' + token);
  let base = m[1];
  if (m[2]) base = base.toLowerCase();
  const def = DEFS[base];
  const times = m[3] || m[5] ? 2 : 1;
  const prime = !!m[4];
  const quarter = def.dir * times * (prime ? -1 : 1);
  return { text: token, turn: { axis: def.axis, layers: def.layers, quarter } };
}

export function parseAlg(alg: string): Move[] {
  return alg
    .replace(/[()[\]]/g, ' ')
    .replace(/’/g, "'")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseMove);
}

export function invertToken(token: string): string {
  if (token.endsWith('2') || token.endsWith("2'")) return token.replace("'", '');
  return token.endsWith("'") ? token.slice(0, -1) : token + "'";
}

export function invertAlg(alg: string): string {
  return alg
    .replace(/[()[\]]/g, ' ')
    .replace(/’/g, "'")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map(invertToken)
    .join(' ');
}

export function applyAlg(state: CubeState, alg: string): CubeState {
  for (const m of parseAlg(alg)) state.applyTurn(m.turn);
  return state;
}

export function stateFrom(alg: string): CubeState {
  return applyAlg(new CubeState(), alg);
}

/** 给孩子看的口令 */
export function kidWords(token: string): string {
  const base = token[0];
  const prime = token.includes("'");
  const two = token.includes('2');
  const table: Record<string, [string, string]> = {
    R: ['右手往上推', '右手往下拉'],
    L: ['左手往下拉', '左手往上推'],
    U: ['顶层往左拨', '顶层往右拨'],
    D: ['底层往右拨', '底层往左拨'],
    F: ['前面顺时针', '前面逆时针'],
    B: ['后面顺时针(从后看)', '后面逆时针(从后看)'],
    M: ['中间层往下', '中间层往上'],
    E: ['赤道层往右', '赤道层往左'],
    S: ['站立层顺时针', '站立层逆时针'],
    r: ['右边两层往上推', '右边两层往下拉'],
    l: ['左边两层往下拉', '左边两层往上推'],
    f: ['前面两层顺时针', '前面两层逆时针'],
    u: ['上面两层往左拨', '上面两层往右拨'],
    d: ['下面两层往右拨', '下面两层往左拨'],
    b: ['后面两层顺时针', '后面两层逆时针'],
    x: ['整个魔方往上翻', '整个魔方往下翻'],
    y: ['整个魔方往左转', '整个魔方往右转'],
    z: ['整个魔方顺时针歪', '整个魔方逆时针歪'],
  };
  const t = table[base];
  if (!t) return token;
  if (two) return t[0] + ' ×2（转两下）';
  return prime ? t[1] : t[0];
}

/** 随机打乱（避免同轴连续） */
export function randomScramble(n = 20, faces = ['R', 'L', 'U', 'D', 'F', 'B']): string {
  const axisOf: Record<string, number> = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };
  const out: string[] = [];
  let lastAxis = -1;
  while (out.length < n) {
    const f = faces[Math.floor(Math.random() * faces.length)];
    if (axisOf[f] === lastAxis) continue;
    lastAxis = axisOf[f];
    out.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]);
  }
  return out.join(' ');
}
