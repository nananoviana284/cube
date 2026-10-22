import { describe, expect, it } from 'vitest';
import { applyAlg, parseAlg, stateFrom } from '../src/cube/alg';
import { FAMILIES, SEE_CASES, doorsOf, familyOf, firstStep, sameStep, stepOptions } from '../src/content/f2lsee';
import { SLOTS, slotCase, slotPieces } from '../src/content/slots';
import type { CubeState } from '../src/cube/model';

const AUFS = ['', 'U', "U'", 'U2'];
const sig = (s: CubeState) => s.cubies.map((c) => `${c.id}@${c.pos}/${c.rot}`).join(';');

describe('一眼认 / 第一步', () => {
  it('every family case is in the book and belongs to exactly one family', () => {
    expect(SEE_CASES.length).toBe(FAMILIES.flatMap((f) => f.cases).length);
    for (const c of SEE_CASES) expect(FAMILIES.filter((f) => f.cases.includes(c.id))).toHaveLength(1);
  });

  for (const slot of SLOTS)
    it(`${slot}: both pieces sit in the top layer, so the top view shows the whole case`, () => {
      for (const c of SEE_CASES)
        for (const auf of AUFS) {
          const s = stateFrom(slotCase(c, slot, auf).setup);
          for (const id of slotPieces(slot)) expect(s.byId(id).pos[1]).toBe(1);
        }
    });

  for (const slot of SLOTS)
    it(`${slot}: every picture has one right answer (no two cases look the same)`, () => {
      const seen = new Map<string, string>();
      for (const c of SEE_CASES)
        for (const auf of AUFS) {
          const k = slotCase(c, slot, auf);
          const key = sig(stateFrom(k.setup));
          expect(seen.has(key), `${c.id} ${auf} looks like ${seen.get(key)}`).toBe(false);
          seen.set(key, `${c.id} ${auf}`);
        }
    });

  for (const slot of SLOTS)
    it(`${slot}: first step = turn the top, then open one of the two doors; the rest solves the slot`, () => {
      for (const c of SEE_CASES)
        for (const auf of AUFS) {
          const k = slotCase(c, slot, auf);
          const f = firstStep(k.solution);
          expect(doorsOf(slot)).toContain(f.door);
          const rest = parseAlg(k.solution).map((m) => m.text);
          while (rest[0][0] === 'U') rest.shift();
          const s = applyAlg(stateFrom(`${k.setup} ${f.u}`), rest.join(' '));
          expect(s.isF2LSolved()).toBe(true);
        }
    });

  it('first-step options: four different choices, exactly one right', () => {
    for (const slot of SLOTS)
      for (const c of SEE_CASES)
        for (const auf of AUFS) {
          const k = slotCase(c, slot, auf);
          for (let n = 0; n < 5; n++) {
            const { options, answer } = stepOptions(k);
            expect(options).toHaveLength(4);
            expect(new Set(options.map((o) => `${o.u}|${o.door}`)).size).toBe(4);
            expect(options.filter((o) => sameStep(o, firstStep(k.solution)))).toHaveLength(1);
            expect(sameStep(options[answer], firstStep(k.solution))).toBe(true);
            for (const o of options) expect(doorsOf(slot)).toContain(o.door);
          }
        }
  });

  it('doors: right-front opens with R or F′, mirrored for the other slots', () => {
    expect(doorsOf('FR')).toEqual(['R', "F'"]);
    expect(doorsOf('FL')).toEqual(["L'", 'F']);
    expect(doorsOf('BR')).toEqual(["R'", 'B']);
    expect(doorsOf('BL')).toEqual(['L', "B'"]);
    expect(familyOf('b3').name).toBe('让路');
    expect(firstStep("U' U R U' R'")).toEqual({ u: '', door: 'R' });
    expect(firstStep("U U R U' R'")).toEqual({ u: 'U2', door: 'R' });
  });
});
