import { invertAlg, randomScramble } from '../cube/alg';
import { F2L_CASES, PLL_CORNERS, PLL_EDGES, joinSteps, type F2LCase } from '../content/algs';
import { partnerOf } from '../content/lessons';
import { load, save } from '../store';
import { beep, celebrate, h, pick, speak, stopSpeak } from '../ui/dom';
import { bubble, keyBtn, keyHints, stage, topbar, wait } from '../ui/components';
import { runDrill } from '../ui/drill';
import { GAMES } from './home';
import { setKeys } from '../ui/keys';
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
  const startBtn = h('button', { class: 'btn green' }, '开始 ▶', h('kbd', null, '空格'));
  side.append(
    bubble('一个方块会闪一下，记住它！魔方转几下以后，你要点出它跑到哪里去了。'),
    info,
    h('div', { class: 'btn-row' }, startBtn),
    h('div', { class: 'parent-note', html: '<b>为什么练这个：</b>"边做边看"(look-ahead)的本质，是手在转的时候眼睛能跟住目标方块。从 1 步慢速开始，每过一关多转一步、转得更快。' }),
  );
  root.append(topbar('🕵️ 跟踪小侦探', '#/', bestLine('track', (v) => `第 ${v} 关`)), h('div', { class: 'player' }, st.el, side));

  const round = async () => {
    if (!alive) return;
    startBtn.style.display = 'none';
    const n = Math.min(1 + Math.floor((level - 1) / 2), 6);
    const ms = Math.max(650 - level * 40, 260);
    info.textContent = `第 ${level} 关 · 转 ${n} 下 · ${'❤️'.repeat(lives)}`;
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
        if (saveBest('track', level - 1, true)) info.textContent = '🏆 新纪录！';
        else info.textContent = '✅ 找到了！';
      } else {
        beep('bad');
        lives--;
        info.textContent = '❌ 是亮着的这个哦';
      }
      await wait(1300);
      if (lives <= 0) {
        celebrate(`闯到第 ${level} 关！`);
        info.textContent = `游戏结束：闯到第 ${level} 关`;
        level = 1;
        lives = 3;
        startBtn.textContent = '再玩一次 ▶';
        startBtn.style.display = '';
        view.highlight(null);
        return;
      }
      view.highlight(null);
      round();
    });
  };
  startBtn.onclick = round;
  setKeys({ space: () => startBtn.style.display !== 'none' && round(), esc: () => (location.hash = '#/') });
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
  const startBtn = h('button', { class: 'btn green' }, '开始 ▶', h('kbd', null, '空格'));
  const side = h('div', { class: 'side' });
  side.append(
    bubble('亮着的是一个白色角块。它去掉白色，剩下的两个颜色就是好朋友棱块。快点出来！'),
    info,
    h('div', { class: 'btn-row' }, startBtn),
    h('div', { class: 'parent-note', html: '<b>为什么练这个：</b>F2L 的观察就是"找配对"。识别越快，十字做完后就越快能开始第一对。可以拖动魔方看背面。' }),
  );
  root.append(topbar('🤝 快找好朋友', '#/', bestLine('friend', (v) => `${(v / 1000).toFixed(1)} 秒`)), h('div', { class: 'player' }, st.el, side));
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
          info.textContent = `⏱ ${(ms / 1000).toFixed(1)} 秒${wrong ? `（点错 ${wrong} 次，每次 +2 秒）` : ''}`;
          startBtn.style.display = '';
          startBtn.textContent = '再来 ▶';
        } else {
          info.textContent = `✅ ${r} / ${ROUNDS}`;
          setTimeout(ask, 400);
        }
      } else {
        wrong++;
        beep('bad');
      }
    });
  };
  startBtn.onclick = () => {
    r = 0;
    wrong = 0;
    t0 = performance.now();
    startBtn.style.display = 'none';
    info.textContent = `0 / ${ROUNDS}`;
    ask();
  };
  setKeys({ space: () => startBtn.style.display !== 'none' && startBtn.click(), esc: () => (location.hash = '#/') });
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
  const lastBox = h('div', { class: 'rate-box' });
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
  const base = { esc: () => (location.hash = '#/') };
  const start = async () => {
    round++;
    current.length = 0;
    const r = await runDrill({
      st,
      box,
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
      h('div', { class: 'step-say big-say' }, `第 ${round} 组完成！平均 ${(avg / 1000).toFixed(1)} 秒${rec ? ' 🏆 新纪录' : ''}${r.fails ? `，没成功 ${r.fails} 次` : ''}`),
      h('div', { class: 'btn-row' }, keyBtn('btn green', '再来一组', '空格', start)),
    );
    setKeys({ ...base, space: start });
  };
  side.append(
    bubble('拿好你的魔方！屏幕出一个情况，你在魔方上摆好，按空格开始计时，做完再按空格。一组 5 个。'),
    box,
    lastBox,
    h('div', { class: 'chips' }, h('span', { class: 'muted' }, '出题范围：'), modeBtn),
    h('div', { class: 'parent-note', html: '<b>怎么用：</b>完全在真魔方上练。用时就是"认出情况 + 做完"的时间，比只看做得对不对更能看出熟练度。每次成功后可以给这个情况打分，"不会"的以后出现得更多。' }),
  );
  root.append(topbar('🌳 好朋友回家练习场', '#/', bestLine('f2l', (v) => `平均 ${(v / 1000).toFixed(1)} 秒`)), h('div', { class: 'player' }, st.el, side));
  box.append(h('div', { class: 'btn-row' }, keyBtn('btn green', '开始 ▶', '空格', start)));
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
  const startBtn = h('button', { class: 'btn green' }, '开始 ▶', h('kbd', null, '空格'));
  const ask = () => {
    const kind = pick(['T', 'Y', 'none'] as const);
    const alg = kind === 'none' ? pick(PLL_EDGES).alg : PLL_CORNERS.find((c) => c.id === kind)!.alg;
    view.setAlg(`${invertAlg(alg)} ${pick(['', 'U', "U'", 'U2'])}`);
    view.resetView();
    const opts: [string, string][] = [
      ['T', '🚦 一面有车灯'],
      ['Y', '🔀 没有车灯'],
      ['none', '✅ 四面都有车灯'],
    ];
    const choose = (i: number) => (box.children[i] as HTMLElement | undefined)?.click();
    setKeys({ '1': () => choose(0), '2': () => choose(1), '3': () => choose(2), esc: () => (location.hash = '#/') });
    box.replaceChildren(
      ...opts.map(([k, label], i) => {
        const b = h('button', { class: 'option' }, h('kbd', { class: 'num' }, String(i + 1)), label);
        b.onclick = () => {
          if (k === kind) {
            beep('good');
            r++;
            if (r >= ROUNDS) {
              const ms = performance.now() - t0 + wrong * 3000;
              const rec = saveBest('lights', ms, false);
              celebrate(rec ? '新纪录！' : '完成！');
              info.textContent = `⏱ ${(ms / 1000).toFixed(1)} 秒${wrong ? `（错 ${wrong} 次，每次 +3 秒）` : ''}`;
              box.replaceChildren();
              startBtn.style.display = '';
              setKeys({ space: () => startBtn.click(), esc: () => (location.hash = '#/') });
            } else {
              info.textContent = `✅ ${r} / ${ROUNDS}`;
              ask();
            }
          } else {
            wrong++;
            beep('bad');
            b.classList.add('no');
          }
        };
        return b;
      }),
    );
  };
  startBtn.onclick = () => {
    r = 0;
    wrong = 0;
    t0 = performance.now();
    startBtn.style.display = 'none';
    ask();
  };
  setKeys({ space: () => startBtn.click(), esc: () => (location.hash = '#/') });
  root.append(
    topbar('🚗 车灯快认', '#/', bestLine('lights', (v) => `${(v / 1000).toFixed(1)} 秒`)),
    h(
      'div',
      { class: 'player' },
      st.el,
      h(
        'div',
        { class: 'side' },
        bubble('顶面已经全黄了。用手指拖动魔方，看一圈侧面：同一面两个角颜色一样就是车灯！'),
        info,
        box,
        h('div', { class: 'btn-row' }, startBtn),
        h('div', { class: 'parent-note', html: '<b>为什么练这个：</b>七步法是"做一遍看看"，CFOP 是"先认出来再做"。真魔方上也可以这样练：做完 OLL 先停 2 秒，说出"车灯在哪边"。' }),
      ),
    ),
  );
  return () => view.dispose();
}

// ——— 乌龟节拍器：慢而不停 ———
function metroGame(root: HTMLElement): () => void {
  let bpm = 60;
  let timer = 0;
  let count = 0;
  const dot = h('div', { class: 'metro-dot' }, '🐢');
  const label = h('div', { class: 'stat' }, h('div', { class: 'v' }, ''), h('div', { class: 'k' }, '每分钟转几下'));
  const counter = h('div', { class: 'stat' }, h('div', { class: 'v' }, '0'), h('div', { class: 'k' }, '已经转了'));
  const slider = h('input', { type: 'range', min: '30', max: '150', step: '5', value: String(bpm) }) as HTMLInputElement;
  const animal = () => (bpm < 60 ? '🐢' : bpm < 90 ? '🐇' : bpm < 120 ? '🐆' : '🚀');
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
  const startBtn = h('button', { class: 'btn green' }, '开始 ▶', h('kbd', null, '空格'));
  const stop = () => {
    clearInterval(timer);
    timer = 0;
    startBtn.textContent = '开始 ▶';
  };
  startBtn.onclick = () => {
    if (timer) return stop();
    count = 0;
    timer = window.setInterval(tick, 60000 / bpm);
    startBtn.textContent = '停 ⏸';
    speak('听节拍，一拍转一下，不要停！');
  };
  const nudge = (d: number) => {
    slider.value = String(Math.min(150, Math.max(30, bpm + d)));
    slider.dispatchEvent(new Event('input'));
  };
  setKeys({ space: () => startBtn.click(), left: () => nudge(-5), right: () => nudge(5), esc: () => (location.hash = '#/') });
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
    topbar('🐢 乌龟节拍器', '#/'),
    bubble('拿出你的魔方，打乱以后跟着"嘀嗒"声，一拍转一下。可以慢，但是不许停！停下来就输啦。'),
    dot,
    h('div', { class: 'stats' }, label, counter),
    h('div', { style: 'margin:16px 0' }, slider),
    h('div', { class: 'btn-row' }, startBtn),
    keyHints([['空格', '开始 / 停'], ['← →', '慢一点 / 快一点'], ['Esc', '回首页']]),
    h(
      'div',
      { class: 'parent-note', style: 'margin-top:16px' },
      h('div', {
        html: '<b>怎么用：</b>从 40~60 开始（一秒一下），用来练 F2L。孩子能整个还原都跟上节拍、不停顿，再加快 10。<br><b>原理：</b>强迫"手不停"，眼睛就只能在转的同时找下一步——这就是 look-ahead。慢而不停的还原，往往比快而停顿的还原总时间更短。',
      }),
    ),
  );
  return () => stop();
}

export function gamePage(root: HTMLElement, id: string): () => void {
  stopSpeak();
  const g = GAMES.find((x) => x.id === id);
  if (!g) {
    location.hash = '#/';
    return () => {};
  }
  switch (id) {
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
