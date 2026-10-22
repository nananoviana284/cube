import { randomScramble } from '../cube/alg';
import { load, save, type Solve } from '../store';
import { beep, h, speak } from '../ui/dom';
import { topbar } from '../ui/components';

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
  line.setAttribute('stroke', '#ff6b6b');
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
  const time = h('div', { class: 'time' }, '0.00');
  const tip = h('div', { class: 'tip' });
  const face = h('div', { class: 'timer-face' }, h('div', null, time, tip));
  const scr = h('div', { class: 'parent-note', style: 'font-size:18px;margin-bottom:12px' });
  const statsBox = h('div', { class: 'stats' });
  const chartBox = h('div', { class: 'chart' });
  const noteRow = h('div', { class: 'chips', style: 'margin-top:12px' });
  const inspBtn = h('button', { class: 'chip' });

  const syncTip = () => {
    tip.textContent =
      mode === 'idle' ? (useInspect ? '点一下开始 15 秒观察' : '点一下开始计时') : mode === 'inspect' ? '只看不动手！看好了再点一下开始' : mode === 'run' ? '还原好了就点一下停' : '点一下开始下一次';
    face.className = 'timer-face' + (mode === 'inspect' ? ' inspect' : mode === 'run' ? ' ready' : '');
    inspBtn.className = 'chip' + (useInspect ? ' on' : '');
    inspBtn.textContent = '15 秒观察';
    scr.replaceChildren(h('b', null, '打乱：'), h('span', { class: 'alg' }, scramble), h('div', { class: 'muted' }, '白色朝下、绿色朝前，照着做'));
  };
  const renderStats = () => {
    const ss = load().solves;
    const best = ss.length ? Math.min(...ss.map((s) => s.ms)) : null;
    const a5 = avgOf(ss, 5);
    const a12 = avgOf(ss, 12);
    statsBox.replaceChildren(
      ...[
        ['最好', best],
        ['5 次平均', a5],
        ['12 次平均', a12],
        ['一共', ss.length],
      ].map(([k, v]) =>
        h('div', { class: 'stat' }, h('div', { class: 'v' }, v === null ? '—' : k === '一共' ? String(v) : fmt(v as number)), h('div', { class: 'k' }, k as string)),
      ),
    );
    chartBox.replaceChildren(h('div', { class: 'muted' }, '最近 40 次'), chart(ss));
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
  const notes = ['十字慢了', 'F2L 卡住了', '找不到下一对', 'OLL 认不出', 'PLL 做错了', '很顺利 😄'];
  const showNotes = () => {
    noteRow.replaceChildren(
      h('span', { class: 'muted' }, '这次哪里卡住？'),
      ...notes.map((n) => {
        const b = h('button', { class: 'chip' }, n);
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
      last = Date.now();
      save((d) => d.solves.push({ at: last, ms }));
      beep('good');
      mode = 'done';
      scramble = randomScramble(20);
      syncTip();
      renderStats();
      showNotes();
    }
  };
  inspBtn.onclick = () => {
    useInspect = !useInspect;
    syncTip();
  };
  syncTip();
  renderStats();
  root.append(topbar('⏱️ 计时器', '#/', inspBtn), scr, face, noteRow, statsBox, chartBox);
  return () => {
    cancelAnimationFrame(raf);
    clearInterval(inspectTimer);
  };
}
