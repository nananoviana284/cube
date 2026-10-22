import { CubeView, type ViewPreset } from '../cube/view';
import { kidWords, parseAlg } from '../cube/alg';
import { load } from '../store';
import { h, speak } from './dom';

export function topbar(title: string, backHref: string | null, right?: Node): HTMLElement {
  return h(
    'div',
    { class: 'topbar' },
    backHref ? h('button', { class: 'back', onclick: () => (location.hash = backHref), 'aria-label': '返回' }, '⬅') : null,
    h('h1', null, title),
    right ?? null,
  );
}

export interface Stage {
  el: HTMLElement;
  view: CubeView;
  badge: HTMLElement;
  cover: (on: boolean, text?: string) => void;
}

/** 3D 魔方舞台，带"摆正视角"按钮 */
export function stage(preset: ViewPreset = 'front', orbit = true): Stage {
  const el = h('div', { class: 'stage' });
  const view = new CubeView(el, { preset, orbit });
  view.speedMs = load().speed;
  const badge = h('div', { class: 'stage-badge', style: 'display:none' });
  const coverEl = h('div', { class: 'stage-cover', style: 'display:none' });
  el.append(
    badge,
    coverEl,
    h(
      'div',
      { class: 'stage-tools' },
      h('button', { onclick: () => view.resetView(), title: '摆正' }, '🎯'),
      h('button', { onclick: () => view.setPreset('top'), title: '看顶面' }, '⬆️'),
    ),
  );
  return {
    el,
    view,
    badge,
    cover(on, text = '🙈') {
      coverEl.style.display = on ? 'grid' : 'none';
      coverEl.textContent = text;
    },
  };
}

export function bubble(text: string, who = '🧑‍🏫'): HTMLElement {
  return h(
    'div',
    { class: 'bubble' },
    h('div', { class: 'who' }, who),
    h('div', { class: 'txt' }, text),
    h('button', { class: 'say', onclick: () => speak(text, true), 'aria-label': '读给我听' }, '🔊'),
  );
}

export function movePad(moves: string[], onMove: (m: string) => void): { el: HTMLElement; mark: (m: string | null) => void } {
  const buttons = new Map<string, HTMLElement>();
  const el = h('div', { class: 'pad' });
  for (const m of moves) {
    const b = h('button', { class: 'move', onclick: () => onMove(m) }, h('b', null, m), h('small', null, kidWords(m)));
    buttons.set(m, b);
    el.append(b);
  }
  // 电脑上可以直接按键盘：R 键 = R，Shift+R = R'，按住 Alt 再按 = 转两下
  const onKey = (e: KeyboardEvent) => {
    if (!el.isConnected) return document.removeEventListener('keydown', onKey);
    if (e.ctrlKey || e.metaKey || (e.target as HTMLElement).tagName === 'INPUT') return;
    const letter = e.code.startsWith('Key') ? e.code.slice(3) : '';
    if (!letter) return;
    const face = /^[RLUDFBM]$/.test(letter) ? letter : /^[XYZ]$/.test(letter) ? letter.toLowerCase() : '';
    if (!face) return;
    const token = face + (e.altKey ? '2' : e.shiftKey ? "'" : '');
    if (!buttons.has(token)) return;
    e.preventDefault();
    const b = buttons.get(token)!;
    b.classList.add('pressed');
    setTimeout(() => b.classList.remove('pressed'), 150);
    onMove(token);
  };
  document.addEventListener('keydown', onKey);
  el.append(h('div', { class: 'keys-tip' }, '⌨️ 电脑键盘：按 R 就是 R，Shift+R 就是 R\'，Alt+U 就是 U2'));
  return {
    el,
    mark(m) {
      for (const [k, b] of buttons) b.classList.toggle('hint', k === m);
    },
  };
}

/** 显示公式，每个转动一个小格子，可以高亮"现在做到哪" */
export function algView(alg: string): { el: HTMLElement; at: (i: number) => void } {
  const toks = parseAlg(alg).map((m) => h('span', { class: 'tok' }, m.text));
  const el = h('div', { class: 'alg' }, ...toks);
  return {
    el,
    at(i) {
      toks.forEach((t, j) => {
        t.classList.toggle('done', j < i);
        t.classList.toggle('now', j === i);
      });
    },
  };
}

/** 逐个转动播放：先亮箭头，再转 */
export async function playWithArrows(view: CubeView, alg: string, onIndex?: (i: number) => void, arrowMs = 420): Promise<void> {
  const moves = parseAlg(alg);
  for (let i = 0; i < moves.length; i++) {
    onIndex?.(i);
    view.showArrow(moves[i].text);
    await wait(arrowMs);
    view.showArrow(null);
    await view.play(moves[i].text);
  }
  onIndex?.(moves.length);
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
