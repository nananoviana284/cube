import { CubeView, type ViewPreset } from '../cube/view';
import { kidWords, parseAlg } from '../cube/alg';
import { load, save } from '../store';
import { h, speak } from './dom';

/** 家长内容（.parent-note）默认隐藏，右上角按钮切换，记住选择 */
export function syncParentView(): void {
  document.body.classList.toggle('parent-on', load().parentView);
}

export function parentToggle(): HTMLElement {
  const b = h('button', { class: 'parent-toggle', title: '家长说明（孩子不用看）' }, '👨‍👩‍👦');
  const sync = () => b.classList.toggle('on', load().parentView);
  b.onclick = () => {
    save((d) => (d.parentView = !d.parentView));
    syncParentView();
    sync();
  };
  sync();
  return b;
}

export function topbar(title: string, backHref: string | null, right?: Node, withParent = true): HTMLElement {
  syncParentView();
  return h(
    'div',
    { class: 'topbar' },
    backHref ? h('button', { class: 'back', onclick: () => (location.hash = backHref), 'aria-label': '返回' }, '⬅', h('kbd', null, 'Esc')) : null,
    h('h1', null, title),
    right ?? null,
    withParent ? parentToggle() : null,
  );
}

/** 底部键位提示，例如 [['空格','继续'],['←','再看']] */
export function keyHints(items: [string, string][]): HTMLElement {
  return h('div', { class: 'key-hints' }, ...items.map(([k, t]) => h('span', null, h('kbd', null, k), t)));
}

/** 大按钮上带键位小标签 */
export function keyBtn(cls: string, label: string, key: string, onclick: () => void): HTMLButtonElement {
  return h('button', { class: cls, onclick }, label, h('kbd', null, key)) as HTMLButtonElement;
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
  // 每转一步，在魔方旁边大字显示指令和口令，帮孩子把字母和动作对上
  const moveTag = h('div', { class: 'move-tag', hidden: true });
  view.onMove = (t) => {
    moveTag.hidden = !t;
    if (t) {
      moveTag.replaceChildren(h('b', null, t), h('small', null, kidWords(t)));
      moveTag.classList.remove('pop');
      void moveTag.offsetWidth;
      moveTag.classList.add('pop');
    }
  };
  const coverEl = h('div', { class: 'stage-cover', style: 'display:none' });
  el.append(
    moveTag,
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
  // 孩子每转一下也念出来，听多了字母和动作就连在一起了
  const press = (m: string) => {
    speak(m);
    onMove(m);
  };
  const el = h('div', { class: 'pad' });
  for (const m of moves) {
    const b = h('button', { class: 'move', onclick: () => press(m) }, h('b', null, m), h('small', null, kidWords(m)));
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
    press(token);
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

/** 逐个转动播放：先亮箭头、显示并念出指令（如"R 撇"），再转 */
export async function playWithArrows(view: CubeView, alg: string, onIndex?: (i: number) => void, arrowMs = 420, voice = true): Promise<void> {
  const moves = parseAlg(alg);
  for (let i = 0; i < moves.length; i++) {
    const t = moves[i].text;
    onIndex?.(i);
    view.showArrow(t);
    view.onMove?.(t);
    await Promise.all([wait(arrowMs), voice ? speak(t) : null]);
    view.showArrow(null);
    await view.play(t);
  }
  onIndex?.(moves.length);
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
