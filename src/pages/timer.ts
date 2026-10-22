import { randomScramble } from '../cube/alg';
import { faceName } from '../cube/model';
import { load, save, type Solve } from '../store';
import { beep, h, speak } from '../ui/dom';
import { algView, kbd, pageHeader, tabbar } from '../ui/components';
import { icon } from '../ui/icons';
import { setKeys } from '../ui/keys';

export function fmt(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return s.toFixed(2);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
}

/** 去掉最快最慢后的平均（WCA 算法），n 次 */
export function avgOf(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const last = solves.slice(-n).map((s) => s.ms);
  if (n < 5) return last.reduce((a, b) => a + b, 0) / n;
  const sorted = [...last].sort((a, b) => a - b).slice(1, -1);
  return sorted.reduce((a, b) => a + b, 0) / sorted.length;
}

export function chart(solves: Solve[]): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 300 120');
  svg.setAttribute('preserveAspectRatio', 'none');
  const data = solves.slice(-40);
  if (data.length < 2) return svg;
  const max = Math.max(...data.map((s) => s.ms)) * 1.1;
  const min = Math.min(...data.map((s) => s.ms)) * 0.9;
  const pts = data.map((s, i) => `${(i / (data.length - 1)) * 290 + 5},${110 - ((s.ms - min) / (max - min)) * 100}`);
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', pts.join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#2468E8');
  line.setAttribute('stroke-width', '2.5');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(line);
  return svg;
}

export function timerPage(root: HTMLElement): () => void {
  type Mode = 'idle' | 'inspect' | 'run' | 'done';
  let mode: Mode = 'idle';
  let useInspect = true;
  let t0 = 0;
  let raf = 0;
  let inspectTimer = 0;
  let last = 0;
  let scramble = randomScramble(20);
  const time = h('span', { class: 'time' }, '0.00');
  const delta = h('span', { class: 'delta', hidden: true });
  const tipText = h('span');
  const tip = h('span', { class: 'tip' }, h('span', { class: 'hint-mouse' }, kbd('空格'), ' 或点一下，'), h('span', { class: 'hint-touch' }, '拍一下，'), tipText);
  const face = h('button', { class: 'timer-face', type: 'button' }, time, delta, tip);
  const scr = h('div', { class: 'scramble-card' });
  const statsBox = h('div', { class: 'stats' });
  const chartBox = h('figure', { class: 'chart' });
  const noteRow = h('div', { class: 'chips notes-row', role: 'group', 'aria-label': '这次哪里卡住' });
  const inspBtn = h('button', { class: 'switch', type: 'button', role: 'switch' }, '先观察 15 秒', h('i'));

  const syncTip = () => {
    tipText.textContent =
      mode === 'idle' ? (useInspect ? '开始 15 秒观察' : '开始计时') : mode === 'inspect' ? '只看不动手！看好了就开始' : mode === 'run' ? '还原好了就停' : '开始下一次';
    face.className = 'timer-face' + (mode === 'inspect' ? ' inspect' : mode === 'run' ? ' ready' : '');
    face.setAttribute('aria-label', tipText.textContent);
    inspBtn.setAttribute('aria-checked', String(useInspect));
    scr.replaceChildren(
      h('div', { class: 'scramble-top' }, h('span', null, `打乱 · 白色朝下、${faceName('F')}色朝前`), h('button', { class: 'small-btn', type: 'button', onclick: newScramble }, '换一个')),
      algView(scramble).el,
    );
  };
  const newScramble = () => {
    if (mode === 'inspect' || mode === 'run') return;
    scramble = randomScramble(20);
    syncTip();
  };
  const renderStats = () => {
    const ss = load().solves;
    const best = ss.length ? Math.min(...ss.map((s) => s.ms)) : null;
    const a5 = avgOf(ss, 5);
    const a12 = avgOf(ss, 12);
    statsBox.replaceChildren(
      ...(
        [
          ['最好', best, 'stat best'],
          ['5 次平均', a5, 'stat'],
          ['12 次平均', a12, 'stat'],
          ['一共', ss.length, 'stat'],
        ] as [string, number | null, string][]
      ).map(([k, v, cls]) =>
        h('div', { class: cls }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v === null ? '—' : k === '一共' ? `${v} 次` : fmt(v))),
      ),
    );
    chartBox.replaceChildren(
      h('figcaption', { class: 'muted' }, '最近 40 次 · 越往下越快'),
      ss.length >= 2 ? chart(ss) : h('p', { class: 'muted chart-empty' }, '计时两次以上，这里就会画出你的进步线。'),
    );
  };
  const tickRun = () => {
    time.textContent = fmt(performance.now() - t0);
    raf = requestAnimationFrame(tickRun);
  };
  const startRun = () => {
    clearInterval(inspectTimer);
    mode = 'run';
    t0 = performance.now();
    tickRun();
    syncTip();
  };
  const notes = ['十字慢了', '好朋友卡住了', '找不到下一对', '顶层认不出', '顶层换错了', '很顺利'];
  const showNotes = () => {
    noteRow.replaceChildren(
      h('span', { class: 'muted' }, '这次哪里卡住？'),
      ...notes.map((n) => {
        const b = h('button', { class: 'chip', type: 'button' }, n);
        b.onclick = () => {
          save((d) => {
            const s = d.solves[d.solves.length - 1];
            if (s && s.at === last) s.note = n;
          });
          [...noteRow.querySelectorAll('.chip')].forEach((c) => c.classList.remove('on'));
          b.classList.add('on');
        };
        return b;
      }),
    );
  };
  face.onclick = () => {
    if (mode === 'idle' || mode === 'done') {
      noteRow.replaceChildren();
      delta.hidden = true;
      if (!useInspect) return startRun();
      mode = 'inspect';
      let left = 15;
      time.textContent = String(left);
      speak('开始观察');
      inspectTimer = window.setInterval(() => {
        left--;
        time.textContent = String(Math.max(left, 0));
        if (left === 8 || left === 3) {
          beep('tick');
          speak(left === 8 ? '8 秒' : '快开始');
        }
        if (left <= 3) face.classList.add('warn');
        if (left <= 0) startRun();
      }, 1000);
      syncTip();
      return;
    }
    if (mode === 'inspect') return startRun();
    if (mode === 'run') {
      cancelAnimationFrame(raf);
      const ms = performance.now() - t0;
      time.textContent = fmt(ms);
      const prev = load().solves[load().solves.length - 1];
      last = Date.now();
      save((d) => d.solves.push({ at: last, ms }));
      beep('good');
      if (prev) {
        const diff = (prev.ms - ms) / 1000;
        delta.hidden = false;
        delta.className = diff >= 0 ? 'delta' : 'delta slower';
        delta.replaceChildren(diff >= 0 ? icon('up', 20) : '', diff >= 0 ? `比上次快 ${diff.toFixed(2)} 秒` : `比上次慢 ${(-diff).toFixed(2)} 秒`);
      }
      mode = 'done';
      scramble = randomScramble(20);
      syncTip();
      renderStats();
      showNotes();
    }
  };
  inspBtn.onclick = () => {
    if (mode === 'inspect' || mode === 'run') return;
    useInspect = !useInspect;
    syncTip();
  };
  syncTip();
  renderStats();
  setKeys({ space: () => face.click(), esc: () => (location.hash = '#/') });
  root.append(
    pageHeader('计时器', undefined, inspBtn),
    h('main', { class: 'timer-layout' }, h('div', { class: 'timer-main' }, scr, face, noteRow), h('aside', { class: 'timer-aside' }, statsBox, chartBox)),
    tabbar('timer'),
  );
  return () => {
    cancelAnimationFrame(raf);
    clearInterval(inspectTimer);
  };
}
