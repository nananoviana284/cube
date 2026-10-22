import { stateFrom } from '../cube/alg';
import { DOOR_NAME, FAMILIES, firstStep, seeRound, stepOptions, stepText, type FirstStep } from '../content/f2lsee';
import { SLOT_NAME, slotCase } from '../content/slots';
import { F2L_CASES } from '../content/algs';
import { load, save, type DrillLog } from '../store';
import { beep, celebrate, h, speak } from '../ui/dom';
import { pairDiagram } from '../ui/diagram';
import { actionBar, bubble, topbar } from '../ui/components';
import { setKeys } from '../ui/keys';

// 好朋友回家的两个"看"的练习：一张图闪出来，按数字键回答，记反应时间。
// 真魔方上做之前，先让眼睛和脑子快起来。

const sec = (ms: number) => `${(ms / 1000).toFixed(1)} 秒`;
const ROUNDS = 10;

interface Question {
  pic: SVGSVGElement;
  options: Node[];
  answer: number;
  /** 答错时说的话 */
  explain: string;
  /** 答错时多给一张图："拨完是这样" */
  after?: { label: string; pic: SVGSVGElement };
  /** 统计哪一类最慢 */
  tag: string;
}

interface FlashConfig {
  id: string;
  title: string;
  intro: string;
  parent: string;
  next: (full: boolean) => Question;
}

/** 反应时间涂颜色：1 秒以内绿，2 秒以内黄，再慢橙 */
const speedCls = (ms: number) => (ms < 1000 ? 'speed-fast' : ms < 2000 ? 'speed-ok' : 'speed-slow');

function recent(id: string): HTMLElement {
  const list = load()
    .drills.filter((d) => d.game === id)
    .slice(-5)
    .reverse();
  if (!list.length) return h('div', { class: 'muted' }, '还没有成绩，玩一组就有了。');
  return h(
    'ol',
    { class: 'flash-recent' },
    ...list.map((d) => {
      const day = new Date(d.at);
      return h(
        'li',
        null,
        h('span', { class: 'muted' }, `${day.getMonth() + 1}/${day.getDate()}`),
        h('b', { class: speedCls(d.avg) }, sec(d.avg)),
        h('span', null, d.wrong ? `错 ${d.wrong}` : '全对'),
        d.slow ? h('span', { class: 'muted' }, `最慢：${d.slow}`) : null,
      );
    }),
  );
}

function flashGame(root: HTMLElement, cfg: FlashConfig): () => void {
  let alive = true;
  let full = false;
  let round = 0;
  let t0 = 0;
  let wrong = 0;
  let times: { ms: number; tag: string }[] = [];
  let answered = false;

  const pic = h('div', { class: 'flash-pic' });
  const timeTag = h('div', { class: 'flash-time' });
  const info = h('div', { class: 'step-say' }, `一组 ${ROUNDS} 题，看一眼就按数字键！`);
  const options = h('div', { class: 'options flash-options' });
  const explain = h('div', { class: 'flash-explain' });
  const recentBox = h('div', null, recent(cfg.id));
  const bar = actionBar();
  const fullBtn = h('button', { class: 'chip', type: 'button' });
  const syncFull = () => (fullBtn.textContent = full ? '难一点：全部上色，自己找好朋友' : '简单：只给好朋友上色');
  syncFull();
  fullBtn.onclick = () => {
    full = !full;
    syncFull();
  };

  const idle = (label: string) => {
    bar.set({ items: [{ label, key: '空格', kind: 'green', icon: 'play', onclick: start }] });
    setKeys({ space: start, esc: () => (location.hash = '#/games') });
  };

  const start = () => {
    round = 0;
    wrong = 0;
    times = [];
    explain.replaceChildren();
    bar.set({ items: [] });
    ask();
  };

  const ask = () => {
    if (!alive) return;
    if (round >= ROUNDS) return finish();
    round++;
    answered = false;
    const q = cfg.next(full);
    explain.replaceChildren();
    timeTag.textContent = '';
    timeTag.className = 'flash-time';
    pic.replaceChildren(q.pic);
    info.textContent = `第 ${round} / ${ROUNDS} 题`;
    const btns = q.options.map((label, i) => {
      const b = h('button', { class: 'option', type: 'button' }, h('kbd', { class: 'num' }, String(i + 1)), label);
      b.onclick = () => choose(i);
      return b;
    });
    options.replaceChildren(...btns);
    const choose = (i: number) => {
      if (answered) return;
      answered = true;
      const ms = performance.now() - t0;
      timeTag.textContent = sec(ms);
      timeTag.classList.add(speedCls(ms));
      if (i === q.answer) {
        btns[i].classList.add('ok');
        beep('good');
        times.push({ ms, tag: q.tag });
        setTimeout(ask, 450);
        return;
      }
      wrong++;
      beep('bad');
      btns[i].classList.add('no');
      btns[q.answer].classList.add('ok');
      explain.replaceChildren(h('p', null, q.explain));
      if (q.after) explain.append(h('figure', { class: 'flash-after' }, q.after.pic, h('figcaption', null, q.after.label)));
      speak(q.explain);
      bar.set({ items: [{ label: '下一题', key: '空格', kind: 'green', icon: 'right', onclick: ask }] });
      setKeys({ space: ask, esc: () => (location.hash = '#/games') });
    };
    setKeys({ ...Object.fromEntries(btns.map((_, i) => [String(i + 1), () => choose(i)])), esc: () => (location.hash = '#/games') });
    t0 = performance.now();
  };

  const finish = () => {
    options.replaceChildren();
    const ok = times.map((t) => t.ms);
    const avg = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : 0;
    // 哪一类最慢
    const byTag = new Map<string, number[]>();
    for (const t of times) byTag.set(t.tag, [...(byTag.get(t.tag) ?? []), t.ms]);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const slow = [...byTag.entries()].sort((a, b) => mean(b[1]) - mean(a[1]))[0];
    const log: DrillLog = { at: Date.now(), game: cfg.id, avg, n: ROUNDS, wrong, slow: byTag.size > 1 ? slow?.[0] : undefined };
    const old = load().best[cfg.id];
    const record = ok.length >= ROUNDS - 2 && (old === undefined || avg < old);
    save((d) => {
      d.drills = [...(d.drills ?? []), log].slice(-200);
      if (record) d.best[cfg.id] = avg;
    });
    const say = `平均 ${sec(avg)}，错了 ${wrong} 个${record ? '，新纪录！' : ''}`;
    info.textContent = say;
    timeTag.textContent = '';
    explain.replaceChildren();
    bestPill.textContent = bestText();
    // 结果放在大图的位置：平均几秒、每一家几秒
    pic.replaceChildren(
      h(
        'div',
        { class: 'flash-result' },
        h('div', { class: 'muted' }, '这一组平均'),
        h('div', { class: `flash-big ${speedCls(avg)}` }, sec(avg)),
        h('div', null, wrong ? `错了 ${wrong} 个` : '全对！'),
        ...[...byTag.entries()]
          .sort((a, b) => mean(b[1]) - mean(a[1]))
          .map(([tag, xs]) => h('div', { class: 'flash-tag' }, h('span', null, tag), h('b', { class: speedCls(mean(xs)) }, sec(mean(xs))))),
      ),
    );
    recentBox.replaceChildren(recent(cfg.id));
    if (record) celebrate('新纪录！');
    else beep('win');
    speak(say);
    idle('再来一组');
  };

  const bestText = () => (load().best[cfg.id] === undefined ? '还没有记录' : `最好：平均 ${sec(load().best[cfg.id])}`);
  const bestPill = h('div', { class: 'pill' }, bestText());
  root.append(
    topbar(cfg.title, '#/games', bestPill),
    h(
      'div',
      { class: 'player' },
      h('div', { class: 'flash-stage' }, pic, timeTag),
      h(
        'div',
        { class: 'side' },
        bubble(cfg.intro),
        info,
        options,
        explain,
        h('div', { class: 'chips' }, fullBtn),
        h('h3', { class: 'flash-h' }, '最近 5 组'),
        recentBox,
        h('div', { class: 'parent-note', html: cfg.parent }),
      ),
    ),
    bar.el,
  );
  idle('开始');
  speak(cfg.intro);
  return () => {
    alive = false;
  };
}

/** 选项里的小例图：右前槽、顶层不拨 */
const example = (caseId: string) => {
  const c = F2L_CASES.find((x) => x.id === caseId)!;
  const sc = slotCase(c, 'FR');
  return pairDiagram(stateFrom(sc.setup), 'FR');
};

// ——— 一眼认：这是哪一家？ ———
export function seeGame(root: HTMLElement): () => void {
  return flashGame(root, {
    id: 'see',
    title: '一眼认',
    intro: '角上带颜色的小方块是好朋友的家。看一眼，按数字说出这是哪一家！',
    parent:
      '<b>练什么：</b>F2L 快不快，先看"认出情况"要几秒。家（槽）随机在四个角，顶层也随机拨过，但魔方不转：孩子要学会不管家在哪，都能一眼认出是哪一家。<br><b>目标：</b>平均 1 秒以内（绿色）。"难一点"会把所有块都上色，要自己先找到这对好朋友，更像真魔方。<br>答错会念出正确的一家和怎么认。',
    next(full) {
      const r = seeRound();
      const fam = r.family;
      return {
        pic: pairDiagram(stateFrom(r.sc.setup), r.sc.slot, full),
        options: FAMILIES.map((f) => h('span', { class: 'flash-opt' }, example(f.cases[0]), h('span', null, h('b', null, f.name), h('small', null, f.look)))),
        answer: FAMILIES.indexOf(fam),
        explain: `这是「${fam.name}」：${fam.look}。家在${SLOT_NAME[r.sc.slot]}。`,
        tag: fam.name,
      };
    },
  });
}

const stepLabel = (s: FirstStep) =>
  h('span', { class: 'flash-step' }, h('b', { class: 'alg' }, stepText(s)), h('small', null, `${s.u ? `拨 ${s.u}，` : '不用拨，'}开${DOOR_NAME[s.door[0]]}`));

// ——— 第一步：家在哪都不转魔方，先拨几下、开哪扇门？ ———
export function firstGame(root: HTMLElement): () => void {
  return flashGame(root, {
    id: 'first',
    title: '第一步',
    intro: '魔方不许整个转！先拨顶层几下，再开哪扇门？按数字选。',
    parent:
      '<b>练什么：</b>高手做 F2L 几乎不转整个魔方，只拨顶层（U），再从离家最近的那扇门开门。这里家随机在四个角，孩子要直接说出第一步。<br><b>原理：</b>先拨顶层，让好朋友摆成认识的样子（站到门口），再开门。答错时会给一张"拨完是这样"的图，就是他会做的那个情况。<br>选项里的箭头：先做左边的拨，再做右边的开门。',
    next(full) {
      const r = seeRound();
      const right = firstStep(r.sc.solution);
      const { options, answer } = stepOptions(r.sc);
      const door = DOOR_NAME[right.door[0]];
      return {
        pic: pairDiagram(stateFrom(r.sc.setup), r.sc.slot, full),
        options: options.map(stepLabel),
        answer,
        explain: `家在${SLOT_NAME[r.sc.slot]}。${right.u ? `先拨 ${right.u}，` : '不用拨，'}再开${door} ${right.door}。整个是：${r.sc.solution}`,
        after: right.u ? { label: `拨完 ${right.u} 是这样`, pic: pairDiagram(stateFrom(`${r.sc.setup} ${right.u}`), r.sc.slot, full) } : undefined,
        tag: r.family.name,
      };
    },
  });
}
