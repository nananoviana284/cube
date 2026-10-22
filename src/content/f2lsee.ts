import { parseAlg } from '../cube/alg';
import { pick, shuffle } from '../ui/dom';
import { F2L_CASES, type F2LCase } from './algs';
import { SLOTS, slotCase, toSlot, type Slot, type SlotCase } from './slots';

// 好朋友回家的两个"看"的练习：
// 一眼认（这是哪一家），第一步（家在哪都不转魔方：先拨几下，开哪扇门）。
// 只出两块都在顶层的情况：从上往下看就能看全，和真魔方上看的一样。

export interface Family {
  id: string;
  name: string;
  /** 一句话：怎么认出它 */
  look: string;
  cases: string[];
}

export const FAMILIES: Family[] = [
  { id: 'meet', name: '碰头', look: '两块分开，白色朝旁边', cases: ['b1', 'b2'] },
  { id: 'move', name: '让路', look: '已经牵好手了', cases: ['b3', 'b4'] },
  { id: 'up', name: '白色朝天', look: '角块的白色朝上', cases: ['a3'] },
  { id: 'wrong', name: '牵错手', look: '挨在一起，可是颜色没对上', cases: ['a4'] },
];

export const familyOf = (caseId: string) => FAMILIES.find((f) => f.cases.includes(caseId))!;

/** 每个槽的两扇门（开门那一下），以及孩子叫它什么 */
export const DOOR_NAME: Record<string, string> = { R: '右门', L: '左门', F: '前门', B: '后门' };

export interface FirstStep {
  /** 先拨几下：'' / U / U' / U2 */
  u: string;
  /** 开哪扇门：第一个不是 U 的转动 */
  door: string;
}

const U_TEXT = ['', 'U', 'U2', "U'"];
const uAmount = (t: string) => (t === 'U' ? 1 : t === 'U2' || t === "U2'" ? 2 : 3);

/** 从解法里读出"第一步"：开头所有的 U 合成一下，再加上第一扇门 */
export function firstStep(solution: string): FirstStep {
  let n = 0;
  for (const m of parseAlg(solution)) {
    if (m.text[0] === 'U') n += uAmount(m.text);
    else return { u: U_TEXT[n % 4], door: m.text };
  }
  return { u: U_TEXT[n % 4], door: '' };
}

export const stepText = (s: FirstStep) => (s.u ? `${s.u} → ${s.door}` : `直接 ${s.door}`);
export const sameStep = (a: FirstStep, b: FirstStep) => a.u === b.u && a.door === b.door;

/** 这个槽的两扇门（都是把家抬上来的方向）：右前是 R 和 F'，别的槽照镜子 */
export const doorsOf = (slot: Slot) => [toSlot('R', slot), toSlot("F'", slot)];

/** "第一步"四个选项：正确的 + 同一扇门拨错 + 另一扇门 */
export function stepOptions(sc: SlotCase): { options: FirstStep[]; answer: number } {
  const right = firstStep(sc.solution);
  const doors = doorsOf(sc.slot);
  const pool: FirstStep[] = [];
  for (const door of doors) for (const u of U_TEXT) pool.push({ u, door });
  const wrong = pool.filter((o) => !sameStep(o, right));
  // 另一扇门、拨得一样，最容易混；再补两个拨错的
  const near = wrong.filter((o) => o.door !== right.door && o.u === right.u);
  const rest = shuffle(wrong.filter((o) => !near.includes(o)));
  const options = shuffle([right, ...near, ...rest].slice(0, 4));
  return { options, answer: options.findIndex((o) => sameStep(o, right)) };
}

export interface SeeRound {
  sc: SlotCase;
  family: Family;
  auf: string;
}

export const SEE_CASES: F2LCase[] = F2L_CASES.filter((c) => FAMILIES.some((f) => f.cases.includes(c.id)));

/** 随机出一题：哪一家、哪个槽、顶层拨到哪 */
export function seeRound(slots: Slot[] = SLOTS): SeeRound {
  const c = pick(SEE_CASES);
  const auf = pick(['', 'U', "U'", 'U2']);
  return { sc: slotCase(c, pick(slots), auf), family: familyOf(c.id), auf };
}
