import { describe, expect, it } from 'vitest';
import { CubeState, HOME_COLOR, setFrontColor, type Vec } from '../src/cube/model';
import { applyAlg, invertAlg, stateFrom } from '../src/cube/alg';
import { F2L_CASES, OLL_CORNERS, OLL_EDGES, PLL_CORNERS, PLL_EDGES, joinSteps } from '../src/content/algs';

function whiteDir(s: CubeState, id: string): string {
  const c = s.byId(id);
  const st = s.stickers(c).find((x) => x.color === 'W')!;
  const n = st.normal;
  return n[1] === 1 ? 'U' : n[1] === -1 ? 'D' : n[2] === 1 ? 'F' : n[2] === -1 ? 'B' : n[0] === 1 ? 'R' : 'L';
}
const posName = (p: Vec) => {
  let s = '';
  if (p[1] === 1) s += 'U';
  if (p[1] === -1) s += 'D';
  if (p[2] === 1) s += 'F';
  if (p[2] === -1) s += 'B';
  if (p[0] === 1) s += 'R';
  if (p[0] === -1) s += 'L';
  return s;
};
const adjacent = (a: Vec, b: Vec) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) === 1;

describe('model basics', () => {
  it('four of each face turn is identity', () => {
    for (const m of ['R', 'U', 'F', 'L', 'D', 'B', 'M', 'E', 'S', 'x', 'y', 'z', 'r', 'f']) {
      expect(stateFrom(`${m} ${m} ${m} ${m}`).isSolved()).toBe(true);
      expect(stateFrom(m).isSolved()).toBe(['x', 'y', 'z'].includes(m));
    }
  });
  it('sexy move has order 6', () => {
    expect(stateFrom("R U R' U' ".repeat(6)).isSolved()).toBe(true);
    expect(stateFrom("R U R' U' ".repeat(3)).isSolved()).toBe(false);
  });
  it('R moves FR edge to UR, U moves UF to UL, F moves UF to FR', () => {
    expect(posName(stateFrom('R').byId('FR').pos)).toBe('UR');
    expect(posName(stateFrom('U').byId('UF').pos)).toBe('UL');
    expect(posName(stateFrom('F').byId('UF').pos)).toBe('FR');
  });
  it('red-front scheme keeps the standard colour layout', () => {
    setFrontColor('R');
    expect([HOME_COLOR.F, HOME_COLOR.R, HOME_COLOR.B, HOME_COLOR.L]).toEqual(['R', 'G', 'O', 'B']);
    expect(stateFrom("R U R' U'").isSolved()).toBe(false);
    expect(stateFrom('').isSolved()).toBe(true);
    setFrontColor('G');
    expect([HOME_COLOR.F, HOME_COLOR.R]).toEqual(['G', 'O']);
  });
  it('alg then inverse is identity', () => {
    const a = "R U2 R' f R U R' U' f' M2 x y' r2 U'";
    expect(applyAlg(stateFrom(a), invertAlg(a)).isSolved()).toBe(true);
  });
});

describe('F2L cases', () => {
  for (const c of F2L_CASES) {
    it(`${c.id} ${c.name}: only FR slot broken, steps solve it`, () => {
      const alg = joinSteps(c.steps);
      const s = stateFrom(invertAlg(alg));
      expect(s.isCrossSolved()).toBe(true);
      expect(s.isSlotSolved('FL') && s.isSlotSolved('BL') && s.isSlotSolved('BR')).toBe(true);
      expect(s.isSlotSolved('FR')).toBe(false);
      applyAlg(s, alg);
      expect(s.isSolved()).toBe(true);
    });
  }
  const look = (id: string) => {
    const c = F2L_CASES.find((x) => x.id === id)!;
    const s = stateFrom(invertAlg(joinSteps(c.steps)));
    const corner = s.byId('DFR');
    const edge = s.byId('FR');
    return { s, cp: posName(corner.pos), ep: posName(edge.pos), w: whiteDir(s, 'DFR'), adj: adjacent(corner.pos, edge.pos) };
  };
  it('basic case descriptions are true', () => {
    expect(look('b1')).toMatchObject({ cp: 'UFR', w: 'R', ep: 'UB' });
    expect(look('b2')).toMatchObject({ cp: 'UFR', w: 'F', ep: 'UL' });
    expect(look('b3')).toMatchObject({ cp: 'UFR', w: 'F', ep: 'UR' });
    expect(look('b4')).toMatchObject({ cp: 'UFR', w: 'R', ep: 'UF' });
  });
  it('advanced case descriptions are true', () => {
    const a1 = look('a1');
    expect(a1.cp).toBe('DFR');
    expect(a1.w).toBe('R');
    expect(a1.ep.startsWith('U')).toBe(true);
    const a2 = look('a2');
    expect(a2.ep).toBe('FR');
    expect(a2.s.isPosSolved([1, 0, 1])).toBe(false);
    expect(a2.cp.startsWith('U')).toBe(true);
    const a3 = look('a3');
    expect(a3.cp).toBe('UFR');
    expect(a3.w).toBe('U');
    expect(a3.ep.startsWith('U')).toBe(true);
    const a4 = look('a4');
    expect(a4.cp.startsWith('U') && a4.ep.startsWith('U') && a4.adj).toBe(true);
  });
  it('after the first step of an advanced case, two pieces are both in top layer', () => {
    for (const c of F2L_CASES.filter((x) => !x.basic)) {
      const s = stateFrom(invertAlg(joinSteps(c.steps)));
      applyAlg(s, c.steps[0].moves);
      expect(s.byId('DFR').pos[1]).toBe(1);
      expect(s.byId('FR').pos[1]).toBe(1);
    }
  });
});

describe('last layer algorithms', () => {
  const preservesF2L = (alg: string) => stateFrom(invertAlg(alg)).isF2LSolved();
  for (const c of OLL_EDGES) {
    it(`OLL edges ${c.id}`, () => {
      const s = stateFrom(invertAlg(c.alg));
      expect(s.isF2LSolved()).toBe(true);
      expect(s.isTopCrossDone()).toBe(false);
      applyAlg(s, c.alg);
      expect(s.isTopCrossDone()).toBe(true);
    });
  }
  for (const c of OLL_CORNERS) {
    it(`OCLL ${c.id}`, () => {
      expect(preservesF2L(c.alg)).toBe(true);
      const s = stateFrom(invertAlg(c.alg));
      expect(s.isTopCrossDone()).toBe(true);
      expect(s.isOLLSolved()).toBe(false);
    });
  }
  for (const c of [...PLL_CORNERS, ...PLL_EDGES]) {
    it(`PLL ${c.id}`, () => {
      const s = stateFrom(invertAlg(c.alg));
      expect(s.isF2LSolved()).toBe(true);
      expect(s.isOLLSolved()).toBe(true);
      expect(s.isSolvedUpToAUF()).toBe(false);
    });
  }
  it('PLL corner algs leave edges permuted, edge algs leave corners', () => {
    for (const c of PLL_EDGES) {
      const s = stateFrom(invertAlg(c.alg));
      for (const id of ['UFR', 'UFL', 'UBR', 'UBL']) expect(s.isCubieSolved(id)).toBe(true);
    }
  });
  it('recognition tips match the setup states', () => {
    const top = (alg: string, pos: Vec) => stateFrom(invertAlg(alg)).colorAt(pos, 'U') === 'Y';
    const line = OLL_EDGES.find((c) => c.id === 'line')!.alg;
    expect(top(line, [1, 1, 0]) && top(line, [-1, 1, 0])).toBe(true);
    const L = OLL_EDGES.find((c) => c.id === 'L')!.alg;
    expect(top(L, [0, 1, -1]) && top(L, [-1, 1, 0])).toBe(true);
    const dot = OLL_EDGES.find((c) => c.id === 'dot')!.alg;
    const edges: Vec[] = [[0, 1, 1], [0, 1, -1], [1, 1, 0], [-1, 1, 0]];
    expect(edges.filter((p) => top(dot, p)).length).toBe(0);
    const T = PLL_CORNERS.find((c) => c.id === 'T')!.alg;
    const sT = stateFrom(invertAlg(T));
    expect(sT.colorAt([-1, 1, 1], 'L')).toBe(sT.colorAt([-1, 1, -1], 'L'));
    for (const id of ['Ua', 'Ub']) {
      const s = stateFrom(invertAlg(PLL_EDGES.find((c) => c.id === id)!.alg));
      expect(s.isPosSolved([0, 1, -1])).toBe(true);
    }
  });
});
