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

import { OLL_CORNERS, OLL_EDGES, PLL_EDGES } from '../src/content/algs';
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
