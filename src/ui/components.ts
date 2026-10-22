import { CubeView, type ViewPreset } from '../cube/view';
import { kidWords, parseAlg } from '../cube/alg';
import { load, save } from '../store';
import { h, speak } from './dom';
import { icon, type IconName } from './icons';

/** 家长内容（.parent-note）默认隐藏，长按右上角的锁切换，记住选择 */
export function syncParentView(): void {
  document.body.classList.toggle('parent-on', load().parentView);
}

const HOLD_MS = 2000;

/**
 * 家长锁：孩子随手点不会进去，按住 2 秒才生效。
 * mode 'notes' 在当前页显示 / 收起家长说明；'center' 进家长中心。
 */
export function parentLock(mode: 'notes' | 'center' = 'notes'): HTMLElement {
  const label = mode === 'center' ? '家长中心（按住 2 秒）' : '家长说明（按住 2 秒）';
  const b = h('button', { class: 'lock', type: 'button', 'aria-label': label, title: label }, icon('lock', 20), h('span', { class: 'lock-tip' }, '按住 2 秒'));
  const sync = () => b.classList.toggle('on', mode === 'notes' && load().parentView);
  let timer = 0;
  const cancel = () => {
    clearTimeout(timer);
    b.classList.remove('holding');
  };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('holding');
    timer = window.setTimeout(() => {
      cancel();
      if (mode === 'center') {
        location.hash = '#/parent';
        return;
      }
      save((d) => (d.parentView = !d.parentView));
      syncParentView();
      sync();
    }, HOLD_MS);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, cancel);
  // 只点一下：提示要按住
  b.addEventListener('click', () => {
    b.classList.add('hint');
    setTimeout(() => b.classList.remove('hint'), 1500);
  });
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  sync();
  return b;
}

export interface HeaderOptions {
  title: string;
  sub?: string;
  /** 左上角 ✕ 去哪（Esc 同样） */
  exitHref: string | null;
  right?: Node;
  /** 标题下面的东西，比如课程进度条 */
  below?: Node;
  withParent?: boolean;
}

/** 活动页顶栏：✕ 退出 · 标题（+进度）· 右侧信息 · 家长锁。位置在所有活动页都一样 */
export function activityHeader(o: HeaderOptions): HTMLElement {
  syncParentView();
  return h(
    'header',
    { class: 'act-head' },
    o.exitHref ? h('button', { class: 'exit', type: 'button', onclick: () => (location.hash = o.exitHref!), 'aria-label': '退出', title: '退出（Esc）' }, icon('close', 24)) : null,
    h('div', { class: 'act-title' }, h('div', { class: 'act-title-row' }, h('h1', null, o.title), o.sub ? h('span', { class: 'act-sub' }, o.sub) : null), o.below ?? null),
    o.right ?? null,
    o.withParent === false ? null : parentLock('notes'),
  );
}

export function topbar(title: string, backHref: string | null, right?: Node, withParent = true): HTMLElement {
  return activityHeader({ title, exitHref: backHref, right, withParent });
}

/** 一级页面（首页、小游戏、计时器、公式本）的标题 */
export function pageHeader(title: string, sub?: string, ...right: Node[]): HTMLElement {
  return h('header', { class: 'page-head' }, h('div', { class: 'page-title' }, h('h1', null, title), sub ? h('div', { class: 'page-sub' }, sub) : null), ...right);
}

export type Tab = 'home' | 'games' | 'timer' | 'book';
const TABS: [Tab, string, IconName, string][] = [
  ['home', '闯关', 'map', '#/'],
  ['games', '小游戏', 'game', '#/games'],
  ['timer', '计时器', 'timer', '#/timer'],
  ['book', '公式本', 'book', '#/book'],
];

/** 底部页签：电脑上是居中的一条，手机上贴底 */
export function tabbar(active: Tab): HTMLElement {
  return h(
    'nav',
    { class: 'tabbar', 'aria-label': '主导航' },
    ...TABS.map(([id, label, ic, href]) =>
      h('a', { href, class: id === active ? 'tab on' : 'tab', 'aria-current': id === active ? 'page' : undefined }, h('span', { class: 'tab-ic' }, icon(ic, 22)), h('span', null, label)),
    ),
  );
}

/** 课程 / 练习的分段进度条 */
export function progressBar(total: number): { el: HTMLElement; set: (i: number) => void } {
  const el = h('div', { class: 'segs', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(total) }, ...Array.from({ length: total }, () => h('span')));
  return {
    el,
    set(i) {
      el.setAttribute('aria-valuenow', String(i + 1));
      el.setAttribute('aria-label', `第 ${i + 1} 步，共 ${total} 步`);
      [...el.children].forEach((s, j) => {
        s.classList.toggle('done', j < i);
        s.classList.toggle('on', j === i);
      });
    },
  };
}

/** 键帽：只在有键盘的设备上显示（CSS 里触屏隐藏） */
export function kbd(key: string): HTMLElement {
  return h('kbd', null, key);
}

/** 底部键位提示已经改成按钮上的键帽；保留这个函数给还没有按钮的键 */
export function keyHints(items: [string, string][]): HTMLElement {
  return h('div', { class: 'key-hints' }, ...items.map(([k, t]) => h('span', null, kbd(k), t)));
}

/** 大按钮上带键位小标签。cls：'btn green'（主按钮）/ 'btn blue'（真魔方）/ 'btn ghost'（次要） */
export function keyBtn(cls: string, label: string, key: string, onclick: () => void, ic?: IconName): HTMLButtonElement {
  return h('button', { class: cls, type: 'button', onclick }, ic ? icon(ic, 22) : null, h('span', { class: 'lbl' }, label), key ? kbd(key) : null) as HTMLButtonElement;
}

export interface Action {
  label: string;
  key?: string;
  kind?: 'green' | 'blue' | 'ghost';
  icon?: IconName;
  onclick: () => void;
}

export interface ActionBar {
  el: HTMLElement;
  /** 左边固定"上一步"，右边是其它按钮；绿色主按钮放最后，永远在右下角 */
  set(o: { back?: () => void; items?: Action[]; note?: string }): void;
  clear(): void;
}

/** 行动条：位置固定。电脑上是一整条；手机上贴底，主按钮整行宽 */
export function actionBar(): ActionBar {
  const el = h('footer', { class: 'actionbar' });
  return {
    el,
    set({ back, items = [], note }) {
      el.replaceChildren(
        ...(back ? [h('button', { class: 'btn ghost ab-back', type: 'button', onclick: back, 'aria-label': '上一步' }, icon('left', 22), h('span', { class: 'lbl' }, '上一步'), kbd('←'))] : []),
        h('div', { class: 'ab-spacer' }, note ? h('span', { class: 'ab-note' }, note) : null),
        ...items.map((a) => keyBtn(`btn ${a.kind ?? 'ghost'} ab-${a.kind ?? 'ghost'}`, a.label, a.key ?? '', a.onclick, a.icon)),
      );
      el.hidden = !back && !items.length && !note;
    },
    clear() {
      el.replaceChildren();
      el.hidden = true;
    },
  };
}

export interface Stage {
  el: HTMLElement;
  view: CubeView;
  badge: HTMLElement;
  cover: (on: boolean, text?: string) => void;
}

/** 3D 魔方舞台，带"摆正""看顶面"按钮和指令牌 */
export function stage(preset: ViewPreset = 'front', orbit = true): Stage {
  const el = h('div', { class: 'stage' });
  const view = new CubeView(el, { preset, orbit });
  view.speedMs = load().speed;
  const badge = h('div', { class: 'stage-badge', style: 'display:none' });
  // 每转一步，在魔方旁边大字显示指令和口令，帮孩子把字母和动作对上
  const moveTag = h('div', { class: 'move-tag', hidden: true, 'aria-live': 'polite' });
  view.onMove = (t) => {
    moveTag.hidden = !t;
    if (t) {
      moveTag.replaceChildren(h('b', null, t), h('small', null, kidWords(t)));
      moveTag.classList.remove('pop');
      void moveTag.offsetWidth;
      moveTag.classList.add('pop');
    }
  };
  const coverText = h('div', { class: 'cover-text' });
  const coverEl = h('div', { class: 'stage-cover', hidden: true }, icon('cube', 72), coverText);
  el.append(
    moveTag,
    badge,
    coverEl,
    ...(orbit ? [h('div', { class: 'stage-hint' }, icon('hand', 18), h('span', { class: 'hint-touch' }, '手指拖动可以转着看'), h('span', { class: 'hint-mouse' }, '鼠标拖动可以转着看'))] : []),
    h(
      'div',
      { class: 'stage-tools' },
      h('button', { type: 'button', onclick: () => view.resetView(), 'aria-label': '摆正', title: '摆正' }, icon('target', 22)),
      h('button', { type: 'button', onclick: () => view.setPreset('top'), 'aria-label': '看顶面', title: '看顶面' }, icon('topView', 22)),
    ),
  );
  return {
    el,
    view,
    badge,
    cover(on, text = '看你手里的魔方') {
      coverEl.hidden = !on;
      coverText.textContent = text;
    },
  };
}

function avatar(): HTMLElement {
  const box = h('span', { class: 'avatar' });
  box.innerHTML =
    '<svg viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" rx="16" fill="#FFC928"/><circle cx="18" cy="22" r="3.5" fill="#1E2240"/><circle cx="34" cy="22" r="3.5" fill="#1E2240"/><path d="M17 32q9 8 18 0" stroke="#1E2240" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>';
  return box;
}

export interface Coach {
  el: HTMLElement;
  set: (text: string, tone?: 'normal' | 'good' | 'retry') => void;
}

/** 教练卡：一句大字 + 喇叭（V 再听） */
export function coach(text: string, opts: { secret?: boolean; big?: boolean } = {}): Coach {
  let current = text;
  const txt = h('p', { class: 'coach-text', 'aria-live': 'polite' }, text);
  const el = h(
    'div',
    { class: `coach${opts.secret ? ' secret' : ''}${opts.big === false ? ' small' : ''}` },
    opts.secret ? h('span', { class: 'avatar key' }, icon('key', 26)) : avatar(),
    txt,
    h('button', { class: 'say', type: 'button', onclick: () => speak(current, true), 'aria-label': '再听一遍' }, icon('speaker', 24), kbd('V')),
  );
  return {
    el,
    set(t, tone = 'normal') {
      current = t;
      txt.textContent = t;
      txt.dataset.tone = tone;
    },
  };
}

/** 一排星星图标（拿到的是黄色） */
export function starRow(n: number, max = 3, size = 16): HTMLElement {
  return h('span', { class: 'star-row', 'aria-label': `${n} 颗星` }, ...Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'star on' : 'star' }, icon('star', size))));
}

export function bubble(text: string): HTMLElement {
  return coach(text, { big: false }).el;
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
    const b = h('button', { class: 'move', type: 'button', onclick: () => press(m) }, h('b', null, m), h('small', null, kidWords(m)));
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
  el.append(h('div', { class: 'keys-tip' }, '电脑键盘：按 R 就是 R，Shift+R 就是 R\'，Alt+U 就是 U2'));
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
