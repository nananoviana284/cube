// 魔方状态模型：26 个小方块（cubie），每个记录"老家"位置、当前位置和朝向。
// 坐标约定：x 向右(R)、y 向上(U)、z 向前(F)。标准配色：黄顶白底、绿前、橙右、红左、蓝后。

export type Vec = [number, number, number];
export type Mat = [number, number, number, number, number, number, number, number, number];

export type Color = 'W' | 'Y' | 'G' | 'B' | 'O' | 'R';
export type Face = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

export const FACE_NORMAL: Record<Face, Vec> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  R: [1, 0, 0],
  L: [-1, 0, 0],
};

export const HOME_COLOR: Record<Face, Color> = {
  U: 'Y',
  D: 'W',
  F: 'G',
  B: 'B',
  R: 'O',
  L: 'R',
};

const SIDE_RING: Color[] = ['G', 'O', 'B', 'R'];

/** 白底黄顶不变，换"朝前的颜色"（例如学过桥式法的孩子习惯红色朝前） */
export function setFrontColor(front: Color): void {
  const i = SIDE_RING.indexOf(front);
  if (i < 0) return;
  HOME_COLOR.F = SIDE_RING[i];
  HOME_COLOR.R = SIDE_RING[(i + 1) % 4];
  HOME_COLOR.B = SIDE_RING[(i + 2) % 4];
  HOME_COLOR.L = SIDE_RING[(i + 3) % 4];
}

export const COLOR_NAME: Record<Color, string> = {
  W: '白',
  Y: '黄',
  G: '绿',
  B: '蓝',
  O: '橙',
  R: '红',
};

/** 某个面老家的颜色名字，例如 faceName('F') === '绿' */
export function faceName(f: Face): string {
  return COLOR_NAME[HOME_COLOR[f]];
}

const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export interface Cubie {
  /** 老家名字，例如 "DFR"（角）、"FR"（棱）、"U"（中心）。用来追踪"同一块" */
  id: string;
  home: Vec;
  pos: Vec;
  rot: Mat;
}

export interface Sticker {
  color: Color;
  /** 当前朝向 */
  normal: Vec;
}

export function faceOfNormal(n: Vec): Face {
  for (const f of Object.keys(FACE_NORMAL) as Face[]) {
    const v = FACE_NORMAL[f];
    if (v[0] === n[0] && v[1] === n[1] && v[2] === n[2]) return f;
  }
  throw new Error('bad normal ' + n.join(','));
}

/** 根据老家坐标给方块起名，顺序固定为 U/D、F/B、R/L，例如 DFR、UB、F */
export function nameOf(home: Vec): string {
  const [x, y, z] = home;
  let s = '';
  if (y === 1) s += 'U';
  if (y === -1) s += 'D';
  if (z === 1) s += 'F';
  if (z === -1) s += 'B';
  if (x === 1) s += 'R';
  if (x === -1) s += 'L';
  return s;
}

/** 方块老家的贴纸：每个非零坐标轴对应一个面 */
export function homeStickers(home: Vec): { face: Face; local: Vec }[] {
  const out: { face: Face; local: Vec }[] = [];
  const [x, y, z] = home;
  if (y !== 0) out.push({ face: y > 0 ? 'U' : 'D', local: [0, y, 0] });
  if (z !== 0) out.push({ face: z > 0 ? 'F' : 'B', local: [0, 0, z] });
  if (x !== 0) out.push({ face: x > 0 ? 'R' : 'L', local: [x, 0, 0] });
  return out;
}

export function mulMV(m: Mat, v: Vec): Vec {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function mulMM(a: Mat, b: Mat): Mat {
  const r = new Array(9).fill(0) as Mat;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j];
      r[i * 3 + j] = s;
    }
  return r;
}

/** 绕轴旋转 quarter*90°（右手定则，正数为逆时针） */
export function rotationMatrix(axis: 0 | 1 | 2, quarter: number): Mat {
  const q = ((quarter % 4) + 4) % 4;
  let m: Mat = IDENTITY;
  const one: Mat =
    axis === 0
      ? [1, 0, 0, 0, 0, -1, 0, 1, 0]
      : axis === 1
        ? [0, 0, 1, 0, 1, 0, -1, 0, 0]
        : [0, -1, 0, 1, 0, 0, 0, 0, 1];
  for (let i = 0; i < q; i++) m = mulMM(one, m);
  return m;
}

/** 一个基本转动：绕 axis 轴，转动坐标在 layers 里的那些方块，quarter 个 90°（右手定则） */
export interface Turn {
  axis: 0 | 1 | 2;
  layers: number[];
  quarter: number;
}

export class CubeState {
  cubies: Cubie[];

  constructor(cubies?: Cubie[]) {
    if (cubies) {
      this.cubies = cubies;
      return;
    }
    this.cubies = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const home: Vec = [x, y, z];
          this.cubies.push({ id: nameOf(home), home, pos: [x, y, z], rot: IDENTITY });
        }
  }

  clone(): CubeState {
    return new CubeState(
      this.cubies.map((c) => ({ id: c.id, home: c.home, pos: [...c.pos] as Vec, rot: [...c.rot] as Mat })),
    );
  }

  applyTurn(t: Turn): void {
    const m = rotationMatrix(t.axis, t.quarter);
    for (const c of this.cubies) {
      if (!t.layers.includes(c.pos[t.axis])) continue;
      c.pos = mulMV(m, c.pos);
      c.rot = mulMM(m, c.rot);
    }
  }

  byId(id: string): Cubie {
    const c = this.cubies.find((c) => c.id === id);
    if (!c) throw new Error('no cubie ' + id);
    return c;
  }

  at(pos: Vec): Cubie {
    const c = this.cubies.find((c) => c.pos[0] === pos[0] && c.pos[1] === pos[1] && c.pos[2] === pos[2]);
    if (!c) throw new Error('no cubie at ' + pos.join(','));
    return c;
  }

  stickers(c: Cubie): Sticker[] {
    return homeStickers(c.home).map((s) => ({ color: HOME_COLOR[s.face], normal: mulMV(c.rot, s.local) }));
  }

  /** 某个面当前的中心颜色（整体转动 x/y/z 后中心会变） */
  centerColor(face: Face): Color {
    const n = FACE_NORMAL[face];
    const c = this.at(n);
    return this.stickers(c)[0].color;
  }

  /** 某个方块当前位置上，朝向 face 那一面的颜色 */
  colorAt(pos: Vec, face: Face): Color | null {
    const c = this.at(pos);
    const n = FACE_NORMAL[face];
    const s = this.stickers(c).find((s) => s.normal[0] === n[0] && s.normal[1] === n[1] && s.normal[2] === n[2]);
    return s ? s.color : null;
  }

  /** 方块是否"回家"：每张贴纸都和它朝向那面的中心同色（与整体朝向无关） */
  isCubieSolved(id: string): boolean {
    const c = this.byId(id);
    return this.stickers(c).every((s) => s.color === this.centerColor(faceOfNormal(s.normal)));
  }

  /** 当前在某个位置上的方块是否正确 */
  isPosSolved(pos: Vec): boolean {
    const c = this.at(pos);
    return this.stickers(c).every((s) => s.color === this.centerColor(faceOfNormal(s.normal)));
  }

  isSolved(): boolean {
    return this.cubies.every((c) => this.isCubieSolved(c.id));
  }

  /** 底层十字（D 面四个棱）是否完成 */
  isCrossSolved(): boolean {
    return (
      [
        [0, -1, 1],
        [0, -1, -1],
        [1, -1, 0],
        [-1, -1, 0],
      ] as Vec[]
    ).every((p) => this.isPosSolved(p));
  }

  /** F2L 某个槽位（FR/FL/BR/BL）的角+棱是否完成 */
  isSlotSolved(slot: 'FR' | 'FL' | 'BR' | 'BL'): boolean {
    const x = slot.includes('R') ? 1 : -1;
    const z = slot.includes('F') ? 1 : -1;
    return this.isPosSolved([x, 0, z]) && this.isPosSolved([x, -1, z]);
  }

  isF2LSolved(): boolean {
    return this.isCrossSolved() && (['FR', 'FL', 'BR', 'BL'] as const).every((s) => this.isSlotSolved(s));
  }

  /** 顶面（U）全部同色 */
  isOLLSolved(): boolean {
    const top = this.centerColor('U');
    for (const c of this.cubies) {
      if (c.pos[1] !== 1) continue;
      if (this.colorAt(c.pos, 'U') !== top) return false;
    }
    return true;
  }

  /** 顶层四个棱块黄色朝上（顶层十字） */
  isTopCrossDone(): boolean {
    const top = this.centerColor('U');
    return (
      [
        [0, 1, 1],
        [0, 1, -1],
        [1, 1, 0],
        [-1, 1, 0],
      ] as Vec[]
    ).every((p) => this.colorAt(p, 'U') === top);
  }

  /** 只差转顶层（AUF）就完成 */
  isSolvedUpToAUF(): boolean {
    const s = this.clone();
    for (let i = 0; i < 4; i++) {
      if (s.isSolved()) return true;
      s.applyTurn({ axis: 1, layers: [1], quarter: -1 });
    }
    return false;
  }
}
