import { load } from '../store';

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** 小巧的建 DOM 工具：h('div', {class: 'x', onclick}, '文字', child) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props)
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else el.setAttribute(k, String(v));
    }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

let zhVoice: SpeechSynthesisVoice | null = null;
function pickVoice(): void {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  zhVoice = voices.find((v) => /zh[-_]CN/i.test(v.lang)) ?? voices.find((v) => /^zh/i.test(v.lang)) ?? null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

/** 文字里单独出现的转动指令，如 R、U'、r2、x */
const MOVE_TOKEN = /(?<![A-Za-z0-9])([RLUDFBMESrludfbxyz])(['2]?)(?![A-Za-z0-9])/g;

/**
 * 指令怎么念：大写正常念，不说"大写"（有的语音会把单独的大写字母念成"大写 U"，
 * 所以交给语音的是小写字母）；小写要强调，念"小 r"。撇念"撇"，2 念"两下"。
 */
export function sayMove(letter: string, suffix = ''): string {
  const isLower = letter === letter.toLowerCase() && !'xyz'.includes(letter);
  const base = isLower ? `小 ${letter}` : letter.toLowerCase();
  return ` ${base}${suffix === "'" ? ' 撇' : suffix === '2' ? ' 两下' : ''} `;
}

/** 用普通话读出来（5 岁孩子不一定认字）。读完（或读不了）时 Promise 结束 */
export function speak(text: string, force = false): Promise<void> {
  if (!('speechSynthesis' in window) || (!force && !load().voice)) return Promise.resolve();
  window.speechSynthesis.cancel();
  const clean = text
    .replace(MOVE_TOKEN, (_m, l: string, suf: string) => sayMove(l, suf))
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'zh-CN';
  if (zhVoice) u.voice = zhVoice;
  u.rate = 0.92;
  u.pitch = 1.1;
  return new Promise((resolve) => {
    // 有的浏览器不触发 onend，按字数估一个最长时间兜底
    const timer = setTimeout(resolve, 1500 + clean.length * 330);
    u.onend = u.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeak(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

let ctx: AudioContext | null = null;
/** 简单音效：good 叮咚、bad 嘟、tick 节拍 */
export function beep(kind: 'good' | 'bad' | 'tick' | 'tock' | 'win'): void {
  try {
    ctx ??= new AudioContext();
    const notes: Record<typeof kind, [number, number][]> = {
      good: [
        [660, 0],
        [880, 0.1],
      ],
      bad: [[200, 0]],
      tick: [[1200, 0]],
      tock: [[800, 0]],
      win: [
        [523, 0],
        [659, 0.12],
        [784, 0.24],
        [1046, 0.36],
      ],
    };
    for (const [f, t] of notes[kind]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = kind === 'bad' ? 'square' : 'sine';
      const at = ctx.currentTime + t;
      const len = kind === 'tick' || kind === 'tock' ? 0.05 : 0.18;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.25, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + len + 0.02);
    }
  } catch {
    // 没有声音也能玩
  }
}

/** 撒星星动画 */
export function celebrate(text = '太棒了！'): void {
  beep('win');
  const layer = h('div', { class: 'celebrate' }, h('div', { class: 'celebrate-text' }, text));
  for (let i = 0; i < 18; i++) {
    const s = h('span', { class: 'confetti', style: `left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.4}s` }, ['⭐', '🌟', '✨', '🎉'][i % 4]);
    layer.append(s);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1800);
}

export function starsText(n: number, max = 3): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
