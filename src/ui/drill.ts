import { kidWords, parseAlg } from '../cube/alg';
import { faceName } from '../cube/model';
import type { DrillCase } from '../content/lessons';
import { load } from '../store';
import { beep, celebrate, h, speak } from './dom';
import { setKeys, type KeyMap } from './keys';
import { keyBtn, keyHints, playWithArrows, wait, type Stage } from './components';

/**
 * 跟着做：每一步亮箭头、大字显示并念出指令、停一会儿再转，孩子用自己的魔方同步做。
 * 空格可以不等停顿直接下一步。alive() 变 false 时停下并返回 false。
 */
export async function followAlong(st: Stage, alg: string, start: string, box: HTMLElement, alive: () => boolean, extraKeys: KeyMap = {}): Promise<boolean> {
  const { view } = st;
  const moves = parseAlg(alg).map((m) => m.text);
  view.setAlg(start);
  view.setPreset('front');
  st.cover(false);
  let skip: (() => void) | null = null;
  setKeys({ ...extraKeys, space: () => skip?.(), right: () => skip?.() });
  for (let i = 0; i < moves.length; i++) {
    if (!alive()) return false;
    const m = moves[i];
    box.replaceChildren(h('div', { class: 'follow-move' }, m, h('small', null, `${kidWords(m)}（${i + 1}/${moves.length}）`)));
    view.showArrow(m);
    view.onMove?.(m);
    await speak(`${m}，${kidWords(m)}`);
    await new Promise<void>((r) => {
      const t = setTimeout(r, load().followPause);
      skip = () => {
        clearTimeout(t);
        r();
      };
    });
    skip = null;
    if (!alive()) return false;
    view.showArrow(null);
    await view.play(m);
  }
  return true;
}

export interface DrillResult {
  /** 每次成功的用时（毫秒） */
  times: number[];
  fails: number;
}

export interface DrillOptions {
  st: Stage;
  box: HTMLElement;
  /** 第 rep 次的题 */
  next: (rep: number) => DrillCase;
  reps: number;
  highlight?: string[];
  alive: () => boolean;
  /** 每个阶段都保留的键（V、Esc、← 等） */
  baseKeys: KeyMap;
  /** 一次成功后（比如在练习场里打分） */
  onSuccess?: (rep: number, ms: number, c: DrillCase) => void;
}

const fmt = (ms: number) => (ms / 1000).toFixed(1);

/**
 * 真魔方练习：屏幕只出题和计时，动手全部在孩子自己的魔方上。
 * 摆题 → 准备（看清楚、想好） → 空格开始计时 → 用真魔方做 → 空格停 → 自己说成功没有。
 * 没成功就看一遍、跟着做一遍，再来。
 */
export function runDrill(o: DrillOptions): Promise<DrillResult> {
  const { st, box } = o;
  const { view } = st;
  const result: DrillResult = { times: [], fails: 0 };
  let rep = 0;
  let c = o.next(0);
  const keys = (map: KeyMap) => setKeys({ ...o.baseKeys, ...map });

  return new Promise((resolve) => {
    const showCase = () => {
      view.setAlg(c.setup);
      view.highlight(o.highlight ?? null);
      view.resetView();
      st.cover(false);
    };

    // ① 摆题
    const setupPhase = () => {
      if (!o.alive()) return;
      showCase();
      const tip = `第 ${rep + 1} 次，一共 ${o.reps} 次。先把魔方复原，白色朝下、${faceName('F')}色朝前，再摆出屏幕上的样子。`;
      box.replaceChildren(
        h('div', { class: 'drill-count' }, `第 ${rep + 1} / ${o.reps} 次`),
        h('div', { class: 'step-say' }, tip),
        h('div', { class: 'btn-row' }, keyBtn('btn blue', '🧊 跟我摆', '2', followSetup), keyBtn('btn green', '摆好了 👌', '空格', readyPhase)),
        keyHints([['2', '一步步带你摆'], ['空格', '摆好了']]),
        h('div', { class: 'parent-note' }, '摆法：从复原的魔方做 ', h('span', { class: 'alg' }, c.setup), '。答案：', h('span', { class: 'alg' }, c.solution)),
      );
      speak(rep === 0 ? `${tip}按 2，我带你摆。` : `第 ${rep + 1} 次。按 2，我带你摆。`);
      keys({ space: readyPhase, '2': followSetup });
    };

    const followSetup = async () => {
      const say = h('div', { class: 'step-say' });
      box.replaceChildren(say);
      keys({});
      const ok = await followAlong(st, c.setup, '', say, o.alive, o.baseKeys);
      if (!ok || !o.alive()) return;
      view.highlight(o.highlight ?? null);
      readyPhase();
    };

    // ② 准备：看清楚是哪种情况，想好再开始
    const readyPhase = () => {
      if (!o.alive()) return;
      showCase();
      box.replaceChildren(
        h('div', { class: 'drill-count' }, `第 ${rep + 1} / ${o.reps} 次`),
        h('div', { class: 'step-say big-say' }, '看一看，想好怎么做。准备好了按空格，开始计时！'),
        h('div', { class: 'btn-row' }, keyBtn('btn green', '开始 ⏱', '空格', runPhase)),
      );
      speak('想好了吗？按空格开始！');
      keys({ space: runPhase });
    };

    // ③ 计时：屏幕盖住，只看手里的魔方
    const runPhase = () => {
      if (!o.alive()) return;
      const t0 = performance.now();
      const clock = h('div', { class: 'drill-clock' }, '0.0');
      st.cover(true, '🧊✋');
      box.replaceChildren(
        h('div', { class: 'step-say big-say' }, '用你的魔方做！做完按空格。'),
        clock,
        h('div', { class: 'btn-row' }, keyBtn('btn green', '做完了', '空格', () => stop())),
      );
      beep('tick');
      let raf = 0;
      const tick = () => {
        clock.textContent = fmt(performance.now() - t0);
        raf = requestAnimationFrame(tick);
      };
      tick();
      const stop = () => {
        cancelAnimationFrame(raf);
        checkPhase(performance.now() - t0);
      };
      keys({ space: stop });
    };

    // ④ 自己判断：好朋友回家了吗？
    const checkPhase = (ms: number) => {
      if (!o.alive()) return;
      box.replaceChildren(
        h('div', { class: 'drill-clock' }, `${fmt(ms)} 秒`),
        h('div', { class: 'step-say big-say' }, '成功了吗？'),
        h('div', { class: 'btn-row' }, keyBtn('btn ghost', '😣 没成功', '1', fail), keyBtn('btn green', '✅ 成功了', '空格', () => success(ms))),
      );
      speak(`${fmt(ms)}秒。成功了吗？成功按空格，没成功按1。`);
      keys({ space: () => success(ms), '1': fail });
    };

    const success = (ms: number) => {
      result.times.push(ms);
      o.onSuccess?.(rep, ms, c);
      beep('good');
      rep++;
      if (rep >= o.reps) {
        celebrate('全部完成！');
        const best = Math.min(...result.times);
        box.replaceChildren(h('div', { class: 'step-say big-say' }, `🎉 ${o.reps} 次都完成了！最快 ${fmt(best)} 秒`));
        speak(`太棒了，最快${fmt(best)}秒！`).then(() => resolve(result));
        return;
      }
      c = o.next(rep);
      setupPhase();
    };

    // 没成功：先看一遍，再跟着做一遍，然后同一题再来
    const fail = async () => {
      result.fails++;
      const say = h('div', { class: 'step-say' }, '没关系！先看我做一遍。');
      box.replaceChildren(say);
      keys({});
      st.cover(false);
      await speak('没关系！先看我做一遍。');
      if (!o.alive()) return;
      showCase();
      await playWithArrows(st.view, c.solution);
      if (!o.alive()) return;
      await wait(600);
      say.textContent = '先把你的魔方复原，我们再摆一次。';
      await speak(say.textContent);
      if (o.alive()) setupPhase();
    };

    setupPhase();
  });
}
