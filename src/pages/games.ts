import { invertAlg, randomScramble } from '../cube/alg';
import { F2L_CASES, PLL_CORNERS, PLL_EDGES, joinSteps, type F2LCase } from '../content/algs';
import { partnerOf } from '../content/lessons';
import { load, logToday, save } from '../store';
import { beep, celebrate, h, pick, speak, stopSpeak } from '../ui/dom';
import { actionBar, bubble, kbd, keyBtn, keyHints, pageHeader, stage, tabbar, topbar, wait } from '../ui/components';
import { runDrill } from '../ui/drill';
import { starsPill } from './home';
import { setKeys } from '../ui/keys';
import { icon, type IconName } from '../ui/icons';
import { firstGame, seeGame } from './flash';

const sec = (v: number) => `${(v / 1000).toFixed(1)} 秒`;

export interface Game {
  id: string;
  icon: IconName;
  name: string;
  desc: string;
  /** 图标底色 / 图标颜色 */
  soft: string;
  ink: string;
  best?: (v: number) => string;
}

/** 第一个是"今天推荐"，大卡片 */
export const GAMES: Game[] = [
  { id: 'see', icon: 'eye', name: '一眼认', desc: '好朋友回家：家在哪都一眼认出是哪一家', soft: '#DDF3E4', ink: '#0B7F3E', best: (v) => `最好 平均 ${sec(v)}` },
  { id: 'first', icon: 'key', name: '第一步', desc: '不转魔方：先拨几下，开哪扇门？', soft: '#E1EBFD', ink: '#1B4FB8', best: (v) => `最好 平均 ${sec(v)}` },
  { id: 'f2l', icon: 'pair', name: '好朋友回家练习场', desc: '拿真魔方，一组 5 个，看看平均几秒', soft: '#DDF3E4', ink: '#0B7F3E', best: (v) => `最好 平均 ${sec(v)}` },
  { id: 'track', icon: 'search', name: '跟踪小侦探', desc: '眼睛跟住一个方块', soft: '#E1EBFD', ink: '#1B4FB8', best: (v) => `最好：第 ${v} 关` },
  { id: 'friend', icon: 'people', name: '快找好朋友', desc: '5 对好朋友，比比谁快', soft: '#DDF3E4', ink: '#0B7F3E', best: (v) => `最好：${sec(v)}` },
  { id: 'lights', icon: 'car', name: '车灯快认', desc: '一眼认出顶层怎么换', soft: '#FBE1DE', ink: '#B42A2D', best: (v) => `最好：${sec(v)}` },
  { id: 'metro', icon: 'metronome', name: '乌龟节拍器', desc: '慢慢转，但是不许停', soft: '#FDE9D3', ink: '#9A5208' },
];

/** 小游戏页签：数字键直接开始 */
export function gamesHub(root: HTMLElement): () => void {
  const best = load().best;
  const open = (id: string) => () => (location.hash = `#/game/${id}`);
  root.append(
    pageHeader('小游戏', '每个游戏练一个高手本领', starsPill()),
    h(
      'main',
      { class: 'games-grid' },
      ...GAMES.map((g, i) => {
        const b = best[g.id];
        return h(
          'a',
          { href: `#/game/${g.id}`, class: i === 0 ? 'game-card feature' : 'game-card', style: `--gc-soft:${g.soft};--gc-ink:${g.ink}` },
          h('span', { class: 'gc-top' }, h('span', { class: 'gc-ic' }, icon(g.icon, i === 0 ? 40 : 30)), kbd(String(i + 1))),
          h(
            'span',
            { class: 'gc-text' },
            i === 0 ? h('span', { class: 'gc-tag' }, '今天推荐') : null,
            h('div', { class: 'gc-name' }, g.name),
            h('div', { class: 'gc-desc' }, g.desc),
            g.best && b !== undefined ? h('div', { class: 'gc-best' }, g.best(b)) : null,
          ),
        );
      }),
    ),
    tabbar('games'),
  );
  setKeys(Object.fromEntries(GAMES.map((g, i) => [String(i + 1), open(g.id)])));
  return () => {};
}

/** 开始按钮放在底部行动条里；玩的时候整条收起来 */
function startBar(label: string, onclick: () => void): { el: HTMLElement; btn: HTMLButtonElement; show: (on: boolean, text?: string) => void; shown: () => boolean } {
  const bar = actionBar();
  const btn = keyBtn('btn green', label, '空格', onclick, 'play');
  bar.el.append(h('div', { class: 'ab-spacer' }), btn);
  bar.el.hidden = false;
  return {
    el: bar.el,
    btn,
    show(on, text) {
      bar.el.hidden = !on;
      if (text) btn.querySelector('.lbl')!.textContent = text;
    },
    shown: () => !bar.el.hidden,
  };
}

const toHub = () => (location.hash = '#/games');
import { rater, withNicks } from './book';

function bestLine(id: string, text: (v: number) => string): HTMLElement {
  const v = load().best[id];
  return h('div', { class: 'pill' }, v === undefined ? '还没有记录' : `最好：${text(v)}`);
}

function saveBest(id: string, v: number, higherIsBetter: boolean): boolean {
  const old = load().best[id];
  const better = old === undefined || (higherIsBetter ? v > old : v < old);
  if (better) save((d) => (d.best[id] = v));
  return better;
}

// ——— 跟踪小侦探：look-ahead 的基础是"边转边跟住一个方块" ———
function trackGame(root: HTMLElement): () => void {
  const st = stage('front');
  const { view } = st;
  let level = 1;
  let lives = 3;
  let alive = true;
  const info = h('div', { class: 'step-say' });
  const side = h('div', { class: 'side' });
  const sb = startBar('开始', () => round());
  side.append(
    bubble('一个方块会闪一下，记住它！魔方转几下以后，你要点出它跑到哪里去了。'),
    info,
    h('div', { class: 'parent-note', html: '<b>为什么练这个：</b>"边做边看"(look-ahead)的本质，是手在转的时候眼睛能跟住目标方块。从 1 步慢速开始，每过一关多转一步、转得更快。' }),
  );
  root.append(topbar('跟踪小侦探', '#/games', bestLine('track', (v) => `第 ${v} 关`)), h('div', { class: 'player' }, st.el, side), sb.el);

  const round = async () => {
    if (!alive) return;
    sb.show(false);
    const n = Math.min(1 + Math.floor((level - 1) / 2), 6);
    const ms = Math.max(650 - level * 40, 260);
    info.textContent = `第 ${level} 关 · 转 ${n} 下 · 还有 ${lives} 次机会`;
    view.setAlg(randomScramble(18));
    view.resetView();
    // 只挑前、右、上三面看得见的非中心方块
    const visible = view.state.cubies.filter((c) => c.id.length > 1 && (c.pos[0] === 1 || c.pos[1] === 1 || c.pos[2] === 1));
    const target = pick(visible).id;
    view.highlight([target]);
    view.glow([target]);
    speak('记住它！');
    await wait(1600);
    if (!alive) return;
    view.highlight(null);
    view.glow([]);
    await wait(300);
    await view.play(randomScramble(n, ['R', 'U', 'F']), ms);
    if (!alive) return;
    info.textContent = '它去哪儿了？点它！';
    speak('它去哪儿了？');
    view.onPick(async (id) => {
      view.onPick(null);
      view.highlight([target]);
      if (id === target) {
        beep('good');
        level++;
        if (saveBest('track', level - 1, true)) info.textContent = '新纪录！';
        else info.textContent = '找到了！';
      } else {
        beep('bad');
        lives--;
        info.textContent = '是亮着的这个哦';
      }
      await wait(1300);
      if (lives <= 0) {
        celebrate(`闯到第 ${level} 关！`);
        info.textContent = `游戏结束：闯到第 ${level} 关`;
        level = 1;
        lives = 3;
        sb.show(true, '再玩一次');
        view.highlight(null);
        return;
      }
      view.highlight(null);
      round();
    });
  };
  setKeys({ space: () => sb.shown() && round(), esc: toHub });
  speak('按空格开始');
  return () => {
    alive = false;
    view.dispose();
  };
}

// ——— 快找好朋友：F2L 配对识别速度 ———
function friendGame(root: HTMLElement): () => void {
  const st = stage('front');
  const { view } = st;
  const ROUNDS = 5;
  let r = 0;
  let t0 = 0;
  let wrong = 0;
  const info = h('div', { class: 'step-say' }, `找 ${ROUNDS} 对好朋友，看看要几秒！`);
  const start = () => {
    r = 0;
    wrong = 0;
    t0 = performance.now();
    sb.show(false);
    info.textContent = `0 / ${ROUNDS}`;
    ask();
  };
  const sb = startBar('开始', () => start());
  const side = h('div', { class: 'side' });
  side.append(
    bubble('亮着的是一个白色角块。它去掉白色，剩下的两个颜色就是好朋友棱块。快点出来！'),
    info,
    h('div', { class: 'parent-note', html: '<b>为什么练这个：</b>F2L 的观察就是"找配对"。识别越快，十字做完后就越快能开始第一对。可以拖动魔方看背面。' }),
  );
  root.append(topbar('快找好朋友', '#/games', bestLine('friend', sec)), h('div', { class: 'player' }, st.el, side), sb.el);
  const corners = ['DFR', 'DFL', 'DBR', 'DBL'];
  const ask = () => {
    view.setAlg(randomScramble(16));
    const c = pick(corners);
    view.highlight([c]);
    view.onPick((id) => {
      if (id === partnerOf(c)) {
        beep('good');
        view.highlight([c, id]);
        r++;
        if (r >= ROUNDS) {
          view.onPick(null);
          const ms = performance.now() - t0 + wrong * 2000;
          const rec = saveBest('friend', ms, false);
          celebrate(rec ? '新纪录！' : '完成！');
          info.textContent = `用了 ${sec(ms)}${wrong ? `（点错 ${wrong} 次，每次 +2 秒）` : ''}`;
          sb.show(true, '再来');
        } else {
          info.textContent = `对！${r} / ${ROUNDS}`;
          setTimeout(ask, 400);
        }
      } else {
        wrong++;
        beep('bad');
      }
    });
  };
  setKeys({ space: () => sb.shown() && start(), esc: toHub });
  return () => view.dispose();
}

// ——— F2L 练习场 ———
function f2lGame(root: HTMLElement): () => void {
  const st = stage('front');
  let alive = true;
  let onlyBasic = true;
  let round = 0;
  const SET = 5;
  const box = h('div', { class: 'side' });
  const bar = actionBar();
  const lastBox = h('div', { class: 'chips' });
  const side = h('div', { class: 'side' });
  const modeBtn = h('button', { class: 'chip' });
  const syncMode = () => (modeBtn.textContent = onlyBasic ? '只练 4 把钥匙' : '全部情况');
  syncMode();
  modeBtn.onclick = () => {
    onlyBasic = !onlyBasic;
    syncMode();
  };
  // 公式本里"不会"的出现得多，"会了"的少
  const pickCase = (): F2LCase => {
    const pool = F2L_CASES.filter((c) => !onlyBasic || c.basic);
    const sk = load().skills;
    const weight = (id: string) => [3, 2, 1][sk[`f2l-${id}`] ?? 1];
    let r = Math.random() * pool.reduce((a, c) => a + weight(c.id), 0);
    return pool.find((c) => (r -= weight(c.id)) < 0) ?? pool[0];
  };
  const current: F2LCase[] = [];
  const base = { esc: toHub };
  const start = async () => {
    round++;
    current.length = 0;
    const r = await runDrill({
      st,
      box,
      bar,
      reps: SET,
      highlight: ['DFR', 'FR'],
      alive: () => alive,
      baseKeys: base,
      next: (rep) => {
        const c = pickCase();
        current[rep] = c;
        const alg = joinSteps(c.steps);
        const auf = pick(['', 'U', "U'", 'U2']);
        return { setup: `${invertAlg(alg)} ${auf}`.trim(), solution: `${auf ? invertAlg(auf) + ' ' : ''}${alg}` };
      },
      onSuccess: (rep, ms) => {
        const c = current[rep];
        lastBox.replaceChildren(h('span', { class: 'muted' }, `刚才：${withNicks(c.name)} ${(ms / 1000).toFixed(1)} 秒，会了吗？`), rater(`f2l-${c.id}`));
      },
    });
    if (!alive) return;
    const avg = r.times.reduce((a, b) => a + b, 0) / r.times.length;
    const rec = saveBest('f2l', avg, false);
    box.replaceChildren(
      h('div', { class: 'step-say big-say' }, `第 ${round} 组完成！平均 ${sec(avg)}${rec ? '，新纪录！' : ''}${r.fails ? `，没成功 ${r.fails} 次` : ''}`),
    );
    bar.set({ items: [{ label: '再来一组', key: '空格', kind: 'green', icon: 'replay', onclick: start }] });
    setKeys({ ...base, space: start });
  };
  side.append(
    bubble('拿好你的魔方！屏幕出一个情况，你在魔方上摆好，按空格开始计时，做完再按空格。一组 5 个。'),
    box,
    lastBox,
    h('div', { class: 'chips' }, h('span', { class: 'muted' }, '出题范围：'), modeBtn),
    h('div', { class: 'parent-note', html: '<b>怎么用：</b>完全在真魔方上练。用时就是"认出情况 + 做完"的时间，比只看做得对不对更能看出熟练度。每次成功后可以给这个情况打分，"不会"的以后出现得更多。' }),
  );
  root.append(topbar('好朋友回家练习场', '#/games', bestLine('f2l', (v) => `平均 ${sec(v)}`)), h('div', { class: 'player' }, st.el, side), bar.el);
  bar.set({ items: [{ label: '开始', key: '空格', kind: 'green', icon: 'play', onclick: start }] });
  setKeys({ ...base, space: start });
  speak('拿好你的魔方，按空格开始');
  return () => {
    alive = false;
    st.view.dispose();
  };
}

// ——— 车灯快认：PLL 识别 ———
function lightsGame(root: HTMLElement): () => void {
  const st = stage('front');
  const { view } = st;
  const ROUNDS = 8;
  let r = 0;
  let wrong = 0;
  let t0 = 0;
  const info = h('div', { class: 'step-say' }, '转动魔方看 4 个侧面，判断车灯。');
  const box = h('div', { class: 'options' });
  const start = () => {
    r = 0;
    wrong = 0;
    t0 = performance.now();
    sb.show(false);
    ask();
  };
  const sb = startBar('开始', () => start());
  const ask = () => {
    const kind = pick(['T', 'Y', 'none'] as const);
    const alg = kind === 'none' ? pick(PLL_EDGES).alg : PLL_CORNERS.find((c) => c.id === kind)!.alg;
    view.setAlg(`${invertAlg(alg)} ${pick(['', 'U', "U'", 'U2'])}`);
    view.resetView();
    const opts: [string, string][] = [
      ['T', '一面有车灯'],
      ['Y', '没有车灯'],
      ['none', '四面都有车灯'],
    ];
    const choose = (i: number) => (box.children[i] as HTMLElement | undefined)?.click();
    setKeys({ '1': () => choose(0), '2': () => choose(1), '3': () => choose(2), esc: toHub });
    box.replaceChildren(
      ...opts.map(([k, label], i) => {
        const b = h('button', { class: 'option', type: 'button' }, h('kbd', { class: 'num' }, String(i + 1)), label);
        b.onclick = () => {
          if (k === kind) {
            beep('good');
            r++;
            if (r >= ROUNDS) {
              const ms = performance.now() - t0 + wrong * 3000;
              const rec = saveBest('lights', ms, false);
              celebrate(rec ? '新纪录！' : '完成！');
              info.textContent = `用了 ${sec(ms)}${wrong ? `（错 ${wrong} 次，每次 +3 秒）` : ''}`;
              box.replaceChildren();
              sb.show(true, '再来');
              setKeys({ space: start, esc: toHub });
            } else {
              info.textContent = `对！${r} / ${ROUNDS}`;
              ask();
            }
          } else {
            wrong++;
            beep('bad');
            b.classList.remove('no');
            void b.offsetWidth;
            b.classList.add('no');
          }
        };
        return b;
      }),
    );
  };
  setKeys({ space: start, esc: toHub });
  root.append(
    topbar('车灯快认', '#/games', bestLine('lights', sec)),
    h(
      'div',
      { class: 'player' },
      st.el,
      h(
        'div',
        { class: 'side' },
        bubble('顶面已经全黄了。转一转魔方，看一圈侧面：同一面两个角颜色一样就是车灯！'),
        info,
        box,
        h('div', { class: 'parent-note', html: '<b>为什么练这个：</b>七步法是"做一遍看看"，CFOP 是"先认出来再做"。真魔方上也可以这样练：做完 OLL 先停 2 秒，说出"车灯在哪边"。' }),
      ),
    ),
    sb.el,
  );
  return () => view.dispose();
}

// ——— 乌龟节拍器：慢而不停 ———
function metroGame(root: HTMLElement): () => void {
  let bpm = 60;
  let timer = 0;
  let count = 0;
  const dot = h('div', { class: 'metro-dot', style: 'font-size:40px' }, '乌龟');
  const label = h('div', { class: 'stat' }, h('div', { class: 'v' }, ''), h('div', { class: 'k' }, '每分钟转几下'));
  const counter = h('div', { class: 'stat' }, h('div', { class: 'v' }, '0'), h('div', { class: 'k' }, '已经转了'));
  const slider = h('input', { type: 'range', min: '30', max: '150', step: '5', value: String(bpm) }) as HTMLInputElement;
  const animal = () => (bpm < 60 ? '乌龟' : bpm < 90 ? '兔子' : bpm < 120 ? '猎豹' : '火箭');
  const sync = () => {
    label.querySelector('.v')!.textContent = String(bpm);
    dot.textContent = animal();
  };
  const tick = () => {
    count++;
    counter.querySelector('.v')!.textContent = String(count);
    beep(count % 4 === 1 ? 'tick' : 'tock');
    dot.classList.add('beat');
    setTimeout(() => dot.classList.remove('beat'), 90);
  };
  const toggle = () => {
    if (timer) return stop();
    count = 0;
    timer = window.setInterval(tick, 60000 / bpm);
    sb.show(true, '停');
    speak('听节拍，一拍转一下，不要停！');
  };
  const sb = startBar('开始', toggle);
  const stop = () => {
    clearInterval(timer);
    timer = 0;
    sb.show(true, '开始');
  };
  const nudge = (d: number) => {
    slider.value = String(Math.min(150, Math.max(30, bpm + d)));
    slider.dispatchEvent(new Event('input'));
  };
  setKeys({ space: toggle, left: () => nudge(-5), right: () => nudge(5), esc: toHub });
  slider.oninput = () => {
    bpm = Number(slider.value);
    sync();
    if (timer) {
      clearInterval(timer);
      timer = window.setInterval(tick, 60000 / bpm);
    }
  };
  sync();
  root.append(
    topbar('乌龟节拍器', '#/games'),
    bubble('拿出你的魔方，打乱以后跟着"嘀嗒"声，一拍转一下。可以慢，但是不许停！停下来就输啦。'),
    dot,
    h('div', { class: 'stats' }, label, counter),
    h('div', { style: 'margin:16px 0' }, slider),
    keyHints([['← →', '慢一点 / 快一点']]),
    h(
      'div',
      { class: 'parent-note', style: 'margin-top:16px' },
      h('div', {
        html: '<b>怎么用：</b>从 40~60 开始（一秒一下），用来练 F2L。孩子能整个还原都跟上节拍、不停顿，再加快 10。<br><b>原理：</b>强迫"手不停"，眼睛就只能在转的同时找下一步——这就是 look-ahead。慢而不停的还原，往往比快而停顿的还原总时间更短。',
      }),
    ),
    sb.el,
  );
  return () => stop();
}

export function gamePage(root: HTMLElement, id: string): () => void {
  stopSpeak();
  const g = GAMES.find((x) => x.id === id);
  if (!g) {
    location.hash = '#/games';
    return () => {};
  }
  logToday('game');
  switch (id) {
    case 'see':
      return seeGame(root);
    case 'first':
      return firstGame(root);
    case 'track':
      return trackGame(root);
    case 'friend':
      return friendGame(root);
    case 'f2l':
      return f2lGame(root);
    case 'lights':
      return lightsGame(root);
    default:
      return metroGame(root);
  }
}
