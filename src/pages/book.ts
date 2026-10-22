import { mirrorAlg } from '../content/slots';
import { F2L_CASES, OLL_CORNERS, OLL_EDGES, PLL_CORNERS, PLL_EDGES, joinSteps, type Step } from '../content/algs';
import { load, save } from '../store';
import { beep, h } from '../ui/dom';
import { invertAlg, stateFrom } from '../cube/alg';
import { effectOf } from '../content/effect';
import { isoDiagram, stateDiagram, type DiagramMode } from '../ui/diagram';
import { kbd, pageHeader, parentLock, tabbar } from '../ui/components';
import { setKeys } from '../ui/keys';

export interface BookEntry {
  key: string;
  group: string;
  name: string;
  emoji: string;
  look: string;
  alg: string;
  diagram?: DiagramMode;
  /** 亲戚：和别的公式的关系 */
  kin?: string;
  chain?: Step[];
  rel?: { label: string; to: string }[];
  /** F2L：每一步在做什么 */
  steps?: Step[];
}

export const BOOK: BookEntry[] = [
  ...F2L_CASES.map((c) => ({
    key: `f2l-${c.id}`,
    group: 'F2L 好朋友回家',
    name: c.name,
    emoji: c.emoji,
    look: c.look,
    alg: joinSteps(c.steps),
    steps: c.steps,
    kin: `照镜子（家在左前）：${mirrorAlg(joinSteps(c.steps))}`,
  })),
  ...OLL_EDGES.map((c) => ({ key: `oe-${c.id}`, group: 'OLL 第一步：黄十字', name: c.name, emoji: c.emoji, look: c.look, alg: c.alg, kin: c.kin, chain: c.chain, rel: c.rel, diagram: 'edges' as const })),
  ...OLL_CORNERS.map((c) => ({ key: `oc-${c.id}`, group: 'OLL 第二步：顶面全黄', name: c.name, emoji: c.emoji, look: c.look, alg: c.alg, kin: c.kin, chain: c.chain, rel: c.rel, diagram: 'oll' as const })),
  ...[...PLL_CORNERS, ...PLL_EDGES].map((c) => ({ key: `p-${c.id}`, group: 'PLL：侧面排好', name: c.name, emoji: c.emoji, look: c.look, alg: c.alg, kin: c.kin, chain: c.chain, rel: c.rel, diagram: 'pll' as const })),
];

export const LEVELS = [
  { v: 0 as const, label: '不会', cls: 'lv0' },
  { v: 1 as const, label: '还不熟', cls: 'lv1' },
  { v: 2 as const, label: '会了', cls: 'lv2' },
];

/** 一排"不会 / 还不熟 / 会了"按钮，点了马上保存 */
export function rater(key: string, onChange?: () => void): HTMLElement {
  const row = h('div', { class: 'rater', role: 'group', 'aria-label': '会不会' });
  const sync = () =>
    row.replaceChildren(
      ...LEVELS.map((l) => {
        const on = load().skills[key] === l.v;
        const b = h('button', { class: `rate ${l.cls}${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on) }, l.label);
        b.onclick = (e) => {
          e.stopPropagation();
          save((d) => (d.skills[key] = l.v));
          beep('tick');
          sync();
          onChange?.();
        };
        return b;
      }),
    );
  sync();
  return row;
}

/** 分组名字和颜色，和原理地图的岛一致 */
export const GROUP_LOOK: Record<string, [string, string]> = {
  'F2L 好朋友回家': ['好朋友回家', '#12A150'],
  'OLL 第一步：黄十字': ['黄十字', '#E5383B'],
  'OLL 第二步：顶面全黄': ['顶面全黄', '#E5383B'],
  'PLL：侧面排好': ['侧面排好', '#E5383B'],
};

export const nameOf = (e: BookEntry) => load().nick[e.key] || e.name;

// 回到公式本时停在原来那一组
let group = BOOK[0].group;
let onlyWeak = false;

/** 公式本（首页）：分组看一格一格的情况图；点一格进详情页 */
export function bookPage(root: HTMLElement): () => void {
  const groups = [...new Set(BOOK.map((b) => b.group))];

  // 顶部：会了 / 还不熟 / 不会 / 没打分
  const summary = h('div', { class: 'skill-bar' });
  const syncSummary = () => {
    const sk = load().skills;
    const n = [2, 1, 0].map((v) => BOOK.filter((b) => sk[b.key] === v).length);
    const none = BOOK.length - n[0] - n[1] - n[2];
    const pct = (x: number) => `${(x / BOOK.length) * 100}%`;
    summary.replaceChildren(
      h('div', { class: 'skill-track', 'aria-hidden': 'true' }, ...n.map((x) => h('span', { style: `width:${pct(x)}` }))),
      h(
        'div',
        { class: 'skill-legend' },
        h('span', null, h('i', { style: 'background:var(--green)' }), `会了 ${n[0]}`),
        h('span', null, h('i', { style: 'background:var(--yellow)' }), `还不熟 ${n[1]}`),
        h('span', null, h('i', { style: 'background:var(--orange)' }), `不会 ${n[2]}`),
        h('span', null, h('i', { style: 'background:var(--line)' }), `还没打分 ${none}`),
      ),
    );
  };

  const open = (e: BookEntry) => (location.hash = `#/f/${e.key}`);

  const tabs = h('div', { class: 'book-tabs', role: 'tablist', 'aria-label': '公式分组' });
  const syncTabs = () =>
    tabs.replaceChildren(
      ...groups.map((g, i) => {
        const [label, color] = GROUP_LOOK[g] ?? [g, '#5A5F7A'];
        const count = BOOK.filter((b) => b.group === g).length;
        return h(
          'button',
          {
            class: g === group ? 'book-tab on' : 'book-tab',
            type: 'button',
            role: 'tab',
            'aria-selected': String(g === group),
            onclick: () => pickGroup(i),
          },
          h('i', { style: `background:${color}` }),
          `${label} ${count}`,
          kbd(String(i + 1)),
        );
      }),
      h(
        'button',
        {
          class: onlyWeak ? 'book-tab weak on' : 'book-tab weak',
          type: 'button',
          'aria-pressed': String(onlyWeak),
          onclick: () => {
            onlyWeak = !onlyWeak;
            syncTabs();
            renderGrid();
          },
        },
        '只看"不会"的',
      ),
    );
  const pickGroup = (i: number) => {
    if (!groups[i]) return;
    group = groups[i];
    syncTabs();
    renderGrid();
  };

  const grid = h('div', { class: 'book-grid' });
  function renderGrid(): void {
    const sk = load().skills;
    const list = BOOK.filter((b) => b.group === group && (!onlyWeak || sk[b.key] === 0));
    grid.replaceChildren(...(list.length ? [] : [h('p', { class: 'muted' }, '这一组没有"不会"的，真棒！')]), ...list.map((e) => tile(e, sk[e.key])));
  }
  /** 一格一个公式：大图直接画出它的情况和效果，下面是名字 */
  const tile = (e: BookEntry, lv: 0 | 1 | 2 | undefined) => {
    const level = LEVELS.find((l) => l.v === lv);
    return h(
      'article',
      {
        class: `book-tile${level ? ` ${level.cls}` : ''}`,
        tabindex: '0',
        role: 'link',
        'aria-label': `打开${nameOf(e)}`,
        onclick: () => open(e),
        onkeydown: (ev: KeyboardEvent) => ev.key === 'Enter' && open(e),
      },
      casePicture(e),
      h('div', { class: 'tile-name' }, level ? h('i', { class: 'tile-dot', title: level.label }) : null, nameOf(e)),
      h('div', { class: 'tile-alg' }, e.alg),
    );
  };

  syncSummary();
  syncTabs();
  renderGrid();
  setKeys({ '1': () => pickGroup(0), '2': () => pickGroup(1), '3': () => pickGroup(2), '4': () => pickGroup(3) });
  root.append(pageHeader('公式本', '每个公式做了什么、为什么、遇到不同角度怎么办', summary, parentLock('center')), tabs, h('main', null, grid), tabbar('book'));
  return () => {};
}

/**
 * 这个公式的情况图：顶层公式画顶面，并叠上效果（打圈 = 会翻上来/拧正，箭头 = 去哪里，蓝框 = 认它要看的贴纸）；
 * 好朋友回家画立体图，这对好朋友和中心块正常颜色，别的块淡一些，虚线框是它们的家。
 */
export function casePicture(e: BookEntry): SVGSVGElement {
  const s = stateFrom(invertAlg(e.alg));
  if (!e.diagram) return isoDiagram(s, ['DFR', 'FR'], [[1, -1, 1], [1, 0, 1]]);
  const ef = effectOf(s, e.diagram);
  return stateDiagram(s, e.diagram, { spins: [...ef.flips, ...ef.twists], arrows: ef.moves, cues: ef.cues });
}

/** 把文字里的公式名字换成"家里的叫法（原名）" */
export function withNicks(text: string): string {
  const nick = load().nick;
  let out = text;
  for (const e of BOOK) {
    const n = nick[e.key];
    if (n && out.includes(e.name)) out = out.split(e.name).join(`${n}（${e.name}）`);
  }
  return out;
}
