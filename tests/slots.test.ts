import { describe, expect, it } from 'vitest';
import { applyAlg, invertAlg, stateFrom } from '../src/cube/alg';
import { F2L_CASES } from '../src/content/algs';
import { SLOTS, mirrorAlg, slotCase, slotPieces } from '../src/content/slots';

describe('four slots', () => {
  it('mirror of the basic insert is the left-hand insert', () => {
    expect(mirrorAlg("R U R'")).toBe("L' U' L");
    expect(mirrorAlg("F' U' F")).toBe("F U F'");
    expect(mirrorAlg('R U2 R')).toBe("L' U2 L'");
  });
  for (const c of F2L_CASES)
    for (const slot of SLOTS)
      it(`${c.id} in ${slot}: only that slot broken, solution solves it`, () => {
        for (const auf of ['', 'U', "U'", 'U2']) {
          const k = slotCase(c, slot, auf);
          const s = stateFrom(k.setup);
          expect(s.isCrossSolved()).toBe(true);
          for (const o of SLOTS) expect(s.isSlotSolved(o)).toBe(o !== slot);
          expect(s.isSolved()).toBe(false);
          applyAlg(s, k.solution);
          expect(s.isSolved()).toBe(true);
        }
      });
  it('slot pieces are real cubie ids', () => {
    const s = stateFrom('');
    for (const slot of SLOTS) for (const id of slotPieces(slot)) expect(() => s.byId(id)).not.toThrow();
  });
  it('front slots never need B moves', () => {
    for (const c of F2L_CASES) for (const slot of ['FR', 'FL'] as const) expect(slotCase(c, slot).setup).not.toMatch(/B/);
  });
  it('inverse helper sanity', () => expect(invertAlg("L' U' L")).toBe("L' U L"));
});

import { OLL_CORNERS, OLL_EDGES, PLL_CORNERS, PLL_EDGES } from '../src/content/algs';
import { LESSONS } from '../src/content/lessons';
import type { CubeState } from '../src/cube/model';


const same = (a: string, b: string) => stateFrom(`${a} ${invertAlg(b)}`).isSolved();
const oc = (id: string) => OLL_CORNERS.find((c) => c.id === id)!.alg;
const others = (s: CubeState, slot: 'FR' | 'FL') => s.isCrossSolved() && (['FR', 'FL', 'BR', 'BL'] as const).filter((x) => x !== slot).every((x) => s.isSlotSolved(x));

describe('formula family claims shown to the child', () => {
  it('小鱼倒着做 = 小鱼（左）', () => expect(same(invertAlg(oc('sune')), oc('antisune'))).toBe(true));
  it('双车灯 = 小鱼做两遍', () => expect(same(oc('H'), `${oc('sune')} ${oc('sune')}`)).toBe(true));
  it("蝴蝶结 = F' + 小T + F", () => expect(same(oc('L'), `F' ${oc('T')} F`)).toBe(true));
  it('一个点 = 一字 + U2 + 小拐弯', () => {
    const [line, L, dot] = ['line', 'L', 'dot'].map((id) => OLL_EDGES.find((c) => c.id === id)!.alg);
    expect(same(dot, `${line} U2 ${L}`)).toBe(true);
  });
  it('三棱轮换顺倒着做 = 逆', () => expect(same(invertAlg(PLL_EDGES[0].alg), PLL_EDGES[1].alg)).toBe(true));
});

describe('door lesson claims', () => {
  it('R takes exactly 3 white stickers off the bottom', () => {
    const s = stateFrom('R');
    const whiteOnD = s.cubies.flatMap((c) => s.stickers(c)).filter((st) => st.normal[1] === -1 && st.color === 'W').length;
    expect(9 - whiteOnD).toBe(3);
  });
  it('open, do something on top, close: cross and other slots stay, only the door pair changes', () => {
    for (const a of ["R U R'", "R U2 R'", "R U' R'", "F' U F"]) {
      const s = stateFrom(a);
      expect(others(s, 'FR')).toBe(true);
      expect(s.isSlotSolved('FR')).toBe(false);
    }
    expect(others(stateFrom("L' U' L"), 'FL')).toBe(true);
  });
  it('the challenges in the door lesson are solved by the revealed moves', () => {
    expect(stateFrom("R U R' R U' R'").isSolved()).toBe(true);
    expect(stateFrom("F' U F F' U' F").isSolved()).toBe(true);
  });
  it('every lesson id is unique', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('yellow cross claims', () => {
  const EDGE_POS = ['UF', 'UR', 'UB', 'UL'].map((id) => stateFrom('').byId(id).home);
  const upMask = (s: CubeState) => EDGE_POS.map((p) => s.colorAt(p, 'U') === s.centerColor('U'));
  const upEdges = (s: CubeState) => upMask(s).filter(Boolean).length;
  const algs = [...OLL_EDGES, ...OLL_CORNERS].map((c) => c.alg);
  it('yellow edges facing up are always 0, 2 or 4', () => {
    for (let i = 0; i < 200; i++) {
      const seq = Array.from({ length: 4 }, (_, j) => `${algs[(i * 7 + j * 3) % algs.length]} ${['', 'U', 'U2', "U'"][(i + j) % 4]}`).join(' ');
      expect(upEdges(stateFrom(seq)) % 2).toBe(0);
    }
  });
  it('a dot plus the line algorithm becomes an L, whatever the angle', () => {
    const [line, L, dot] = ['line', 'L', 'dot'].map((id) => OLL_EDGES.find((c) => c.id === id)!);
    for (const auf of ['', 'U', 'U2', "U'"]) {
      const s = stateFrom(`${invertAlg(dot.alg)} ${auf}`);
      expect(upEdges(s)).toBe(0);
      applyAlg(s, line.alg);
      const m = upMask(s);
      expect(upEdges(s)).toBe(2);
      expect((m[0] && m[2]) || (m[1] && m[3])).toBe(false);
    }
    const s = stateFrom(invertAlg(dot.alg));
    for (const st of dot.chain!) applyAlg(s, st.moves);
    expect(upEdges(s)).toBe(4);
    expect(L.alg).toBe(dot.chain![2].moves);
  });
  it('H chain: one sune leaves a sune case, the second solves it', () => {
    const H = OLL_CORNERS.find((c) => c.id === 'H')!;
    const s = stateFrom(invertAlg(H.alg));
    applyAlg(s, H.chain![0].moves);
    expect(s.isSolved()).toBe(false);
    expect(applyAlg(s.clone(), oc('sune')).isSolved()).toBe(true);
    applyAlg(s, H.chain![1].moves);
    expect(s.isSolved()).toBe(true);
  });
  it('every rel points at a real formula', () => {
    const keys = new Set([...OLL_EDGES.map((c) => `oe-${c.id}`), ...OLL_CORNERS.map((c) => `oc-${c.id}`), ...[...PLL_CORNERS, ...PLL_EDGES].map((c) => `p-${c.id}`)]);
    for (const c of [...OLL_EDGES, ...OLL_CORNERS, ...PLL_CORNERS, ...PLL_EDGES]) for (const r of c.rel ?? []) expect(keys.has(r.to)).toBe(true);
  });
});
