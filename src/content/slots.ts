import { invertAlg, parseAlg } from '../cube/alg';
import { pick } from '../ui/dom';
import { F2L_CASES, joinSteps, type F2LCase, type Step } from './algs';

// 四个槽：原理只讲一次（右前槽），用"照镜子"和"转个方向"变到其他槽。
// 这样孩子学到的是"门在哪就开哪扇门"，而不是"把魔方转成课本的样子"。

export type Slot = 'FR' | 'FL' | 'BR' | 'BL';
export const SLOTS: Slot[] = ['FR', 'FL', 'BR', 'BL'];
export const SLOT_NAME: Record<Slot, string> = { FR: '右前', FL: '左前', BR: '右后', BL: '左后' };
export const slotPieces = (s: Slot) => [`D${s}`, s];

const tokens = (alg: string) => parseAlg(alg).map((m) => m.text);
const split = (t: string) => {
  const m = /^([A-Za-z])(w?)(.*)$/.exec(t)!;
  return { base: m[1], wide: m[2], rest: m[3] };
};
const flip = (rest: string) => (rest.includes('2') ? rest.replace("'", '') : rest.includes("'") ? rest.replace("'", '') : rest + "'");

/**
 * 照镜子（左右对调）：R ↔ L'，U → U'，F → F'……
 * 右前槽的公式照镜子，就是左前槽的公式。
 */
export function mirrorAlg(alg: string): string {
  const swap: Record<string, string> = { R: 'L', L: 'R', r: 'l', l: 'r' };
  return tokens(alg)
    .map((t) => {
      const { base, wide, rest } = split(t);
      if (base === 'M' || base === 'x') return t;
      return (swap[base] ?? base) + wide + flip(rest);
    })
    .join(' ');
}

/** 前后对调（照"前后的镜子"）：F ↔ B'，R → R'，U → U'。右前槽的公式变成右后槽的。 */
export function mirrorFB(alg: string): string {
  const swap: Record<string, string> = { F: 'B', B: 'F', f: 'b', b: 'f' };
  return tokens(alg)
    .map((t) => {
      const { base, wide, rest } = split(t);
      if (base === 'S' || base === 'z') return t;
      return (swap[base] ?? base) + wide + flip(rest);
    })
    .join(' ');
}

/** 把右前槽的公式变到任何一个槽 */
export function toSlot(alg: string, slot: Slot): string {
  if (slot === 'FR') return alg;
  if (slot === 'FL') return mirrorAlg(alg);
  if (slot === 'BR') return mirrorFB(alg);
  return mirrorFB(mirrorAlg(alg));
}

export interface SlotCase {
  c: F2LCase;
  slot: Slot;
  /** 从复原的魔方做这个，就摆出这个情况 */
  setup: string;
  /** 一种解法（没成功时演示用） */
  solution: string;
  steps: Step[];
}

/** 某个 F2L 情况放到某个槽，可以再随机拨一下顶层 */
export function slotCase(c: F2LCase, slot: Slot, auf = ''): SlotCase {
  const steps = c.steps.map((s) => ({ ...s, moves: toSlot(s.moves, slot) }));
  const alg = joinSteps(steps);
  return {
    c,
    slot,
    steps,
    setup: `${invertAlg(alg)} ${auf}`.trim(),
    solution: `${auf ? invertAlg(auf) + ' ' : ''}${alg}`,
  };
}

const randU = () => pick(['', 'U', "U'", 'U2']);
export const BASIC_CASES = F2L_CASES.filter((c) => c.basic);

/** 随机出题：从给定的情况和槽里随便挑，顶层也随便拨 */
export function randomSlotCase(cases: F2LCase[] = BASIC_CASES, slots: Slot[] = SLOTS): SlotCase {
  return slotCase(pick(cases), pick(slots), randU());
}
