import { invertAlg, randomScramble } from '../cube/alg';
import { F2L_CASES, PLL_CORNERS, PLL_EDGES, joinSteps } from '../content/algs';
import { partnerOf } from '../content/lessons';
import { load, save } from '../store';
import { beep, celebrate, h, pick, speak, stopSpeak } from '../ui/dom';
import { bubble, movePad, playWithArrows, stage, topbar, wait } from '../ui/components';
import { GAMES } from './home';
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
  const startBtn = h('button', { class: 'btn green' }, '开始 ▶');
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
  const startBtn = h('button', { class: 'btn green' }, '开始 ▶');
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
  return () => view.dispose();
}

// ——— F2L 练习场 ———
function f2lGame(root: HTMLElement): () => void {
  const st = stage('front');
  const { view } = st;
  let onlyBasic = true;
  let solved = 0;
  let current = F2L_CASES[0];
  let setup = '';
  let auf = '';
  let hinting = false;
  const info = h('div', { class: 'step-say' });
  const rateBox = h('div', { class: 'rate-box' });
  const side = h('div', { class: 'side' });
  const modeBtn = h('button', { class: 'btn ghost' });
  const newCase = () => {
    const pool = F2L_CASES.filter((c) => !onlyBasic || c.basic);
    // 公式本里"不会"的出现得多，"会了"的少
    const sk = load().skills;
    const weight = (id: string) => [3, 2, 1][sk[`f2l-${id}`] ?? 1];
    let r = Math.random() * pool.reduce((a, c) => a + weight(c.id), 0);
    current = pool.find((c) => (r -= weight(c.id)) < 0) ?? pool[0];
    rateBox.replaceChildren(h('span', { class: 'muted' }, '这一个：'), rater(`f2l-${current.id}`));
    auf = pick(['', 'U', "U'", 'U2']);
    setup = `${invertAlg(joinSteps(current.steps))} ${auf}`.trim();
    view.setAlg(setup);
    view.highlight(['DFR', 'FR']);
    view.showArrow(null);
    hinting = false;
    pad.mark(null);
    info.textContent = `已完成 ${solved} 个 · 先想一想：这是哪把钥匙？`;
  };
  const pad = movePad(['R', "R'", 'U', "U'", 'F', "F'", 'U2'], async (m) => {
    if (view.busy) return;
    view.showArrow(null);
    pad.mark(null);
    await view.play(m);
    if (view.state.isSolved()) {
      solved++;
      beep('good');
      celebrate('回家啦！');
      await wait(900);
      newCase();
    }
  });
  const hintBtn = h('button', { class: 'btn ghost' }, '💡 看答案');
  hintBtn.onclick = async () => {
    if (hinting) return;
    hinting = true;
    view.setAlg(setup);
    info.textContent = withNicks(`${current.emoji} ${current.name}：${current.look}`);
    speak(load().nick[`f2l-${current.id}`] || current.name);
    await playWithArrows(view, `${auf ? invertAlg(auf) : ''} ${joinSteps(current.steps)}`.trim());
    await wait(600);
    view.setAlg(setup);
    hinting = false;
  };
  const sync = () => (modeBtn.textContent = onlyBasic ? '只练 4 把钥匙 ✓' : '全部情况 ✓');
  modeBtn.onclick = () => {
    onlyBasic = !onlyBasic;
    sync();
    newCase();
  };
  sync();
  side.append(
    bubble('让亮着的好朋友回家！先说出是哪把钥匙，再动手。'),
    info,
    pad.el,
    rateBox,
    h('div', { class: 'btn-row' }, hintBtn, h('button', { class: 'btn ghost', onclick: () => view.setAlg(setup) }, '🔁 重来'), h('button', { class: 'btn ghost', onclick: newCase }, '⏭ 换一个')),
    modeBtn,
  );
  root.append(topbar('🌳 好朋友回家练习场', '#/'), h('div', { class: 'player' }, st.el, side));
  newCase();
  return () => view.dispose();
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
  const startBtn = h('button', { class: 'btn green' }, '开始 ▶');
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
    box.replaceChildren(
      ...opts.map(([k, label]) => {
        const b = h('button', { class: 'option' }, label);
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
  const startBtn = h('button', { class: 'btn green' }, '开始 ▶');
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
