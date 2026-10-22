import { describe, expect, it } from 'vitest';
import { applyAlg, invertAlg, stateFrom } from '../src/cube/alg';
import { OLL_CORNERS, OLL_EDGES, PLL_CORNERS, PLL_EDGES } from '../src/content/algs';
import { anglesOf, cycles, effectOf, effectText, posName } from '../src/content/effect';

const eff = (alg: string, mode: 'oll' | 'pll' | 'edges') => effectOf(stateFrom(invertAlg(alg)), mode);
const names = (ps: number[][]) => ps.map((p) => posName(p as [number, number, number])).sort().join(',');
const E = (id: string) => OLL_EDGES.find((c) => c.id === id)!.alg;
const C = (id: string) => OLL_CORNERS.find((c) => c.id === id)!.alg;

describe('formula effects', () => {
  it('yellow cross: which edges flip up', () => {
    expect(names(eff(E('line'), 'edges').flips)).toBe('前,后');
    expect(names(eff(E('L'), 'edges').flips)).toBe('前,右');
    expect(eff(E('dot'), 'edges').flips.length).toBe(4);
    expect(eff(E('L'), 'edges').twists.length).toBe(0);
  });
  it('corner orientation: which corners twist', () => {
    expect(eff(C('sune'), 'oll').twists.length).toBe(3);
    expect(eff(C('H'), 'oll').twists.length).toBe(4);
    expect(eff(C('T'), 'oll').twists.length).toBe(2);
    for (const c of OLL_CORNERS) expect(eff(c.alg, 'oll').flips.length).toBe(0);
  });
  it('flipped/twisted pieces really end up yellow-up after the formula', () => {
    for (const c of [...OLL_EDGES.map((x) => [x.alg, 'edges'] as const), ...OLL_CORNERS.map((x) => [x.alg, 'oll'] as const)]) {
      const s = stateFrom(invertAlg(c[0]));
      const e = effectOf(s, c[1]);
      applyAlg(s, c[0]);
      for (const p of [...e.flips, ...e.twists]) expect(s.colorAt(p, 'U')).toBe(s.centerColor('U'));
    }
  });
  it('PLL arrows: every arrow ends where the piece belongs', () => {
    for (const c of [...PLL_CORNERS, ...PLL_EDGES]) {
      const s = stateFrom(invertAlg(c.alg));
      const e = effectOf(s, 'pll');
      expect(e.moves.length).toBeGreaterThan(0);
      for (const m of e.moves) {
        const piece = s.at(m.from).id;
        const done = applyAlg(s.clone(), c.alg);
        expect(done.byId(piece).pos).toEqual(m.to);
      }
    }
    const ua = effectOf(stateFrom(invertAlg(PLL_EDGES[0].alg)), 'pll');
    expect(cycles(ua.moves).map((c) => c.length)).toEqual([3]);
    const t = effectOf(stateFrom(invertAlg(PLL_CORNERS[0].alg)), 'pll');
    expect(cycles(t.moves).map((c) => c.length).sort()).toEqual([2, 2]);
  });
  it('PLL T has its headlights on one side only', () => {
    const t = effectOf(stateFrom(invertAlg(PLL_CORNERS[0].alg)), 'pll');
    expect(t.cues.length).toBe(2);
    const y = effectOf(stateFrom(invertAlg(PLL_CORNERS[1].alg)), 'pll');
    expect(y.cues.length).toBe(0);
  });
  it('angles: symmetric cases have fewer, and pre-turn + formula solves each', () => {
    expect(anglesOf(E('dot'), 'edges').length).toBe(1);
    expect(anglesOf(E('line'), 'edges').length).toBe(2);
    expect(anglesOf(E('L'), 'edges').length).toBe(4);
    expect(anglesOf(C('H'), 'oll').length).toBe(2);
    expect(anglesOf(C('sune'), 'oll').length).toBe(4);
    for (const c of [...OLL_EDGES, ...OLL_CORNERS, ...PLL_CORNERS, ...PLL_EDGES])
      for (const a of anglesOf(c.alg, 'pll')) expect(applyAlg(a.state.clone(), `${a.pre} ${c.alg}`).isSolved()).toBe(true);
  });
  it('text names the right pieces', () => {
    expect(effectText(eff(E('L'), 'edges'), 'edges')).toContain('前、右 2 个棱块翻上来');
    expect(effectText(eff(PLL_EDGES[0].alg, 'pll'), 'pll')).toContain('3 个棱转一圈');
  });
});
