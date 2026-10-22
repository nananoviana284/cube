import { invertAlg } from '../cube/alg';
import { F2L_CASES, OLL_CORNERS, OLL_EDGES, PLL_CORNERS, PLL_EDGES, joinSteps } from '../content/algs';
import { load, save } from '../store';
import { beep, h } from '../ui/dom';
import { topDiagram } from '../ui/diagram';
import { algView, playWithArrows, stage, topbar } from '../ui/components';

export interface BookEntry {
  key: string;
  group: string;
  name: string;
  emoji: string;
  look: string;
  alg: string;
  diagram?: 'oll' | 'pll';
}

export const BOOK: BookEntry[] = [
  ...F2L_CASES.map((c) => ({ key: `f2l-${c.id}`, group: 'F2L 好朋友回家', name: c.name, emoji: c.emoji, look: c.look, alg: joinSteps(c.steps) })),
  ...OLL_EDGES.map((c) => ({ key: `oe-${c.id}`, group: 'OLL 第一步：黄十字', name: c.name, emoji: c.emoji, look: c.look, alg: c.alg, diagram: 'oll' as const })),
  ...OLL_CORNERS.map((c) => ({ key: `oc-${c.id}`, group: 'OLL 第二步：顶面全黄', name: c.name, emoji: c.emoji, look: c.look, alg: c.alg, diagram: 'oll' as const })),
  ...[...PLL_CORNERS, ...PLL_EDGES].map((c) => ({ key: `p-${c.id}`, group: 'PLL：侧面排好', name: c.name, emoji: c.emoji, look: c.look, alg: c.alg, diagram: 'pll' as const })),
];

export const LEVELS = [
  { v: 0 as const, label: '不会', cls: 'lv0' },
  { v: 1 as const, label: '还不熟', cls: 'lv1' },
  { v: 2 as const, label: '会了', cls: 'lv2' },
];

/** 一排"不会 / 还不熟 / 会了"按钮，点了马上保存 */
export function rater(key: string, onChange?: () => void): HTMLElement {
  const row = h('div', { class: 'rater' });
  const sync = () =>
    row.replaceChildren(
      ...LEVELS.map((l) => {
        const b = h('button', { class: `chip ${l.cls}${load().skills[key] === l.v ? ' on' : ''}` }, l.label);
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

/** 公式本：每个情况一张卡片——图、公式、家里的叫法、会不会 */
export function bookPage(root: HTMLElement): () => void {
  const st = stage('top');
  const { view } = st;
  const caption = h('div', { class: 'step-say' }, '点任意一张卡片的 👀，上面的魔方就会演示它。');
  const algBox = h('div');
  const summary = h('div', { class: 'chips' });
  const syncSummary = () => {
    const sk = load().skills;
    const n = [0, 1, 2].map((v) => BOOK.filter((b) => sk[b.key] === v).length);
    const none = BOOK.length - n[0] - n[1] - n[2];
    summary.replaceChildren(
      h('span', { class: 'chip lv2 on' }, `会了 ${n[2]}`),
      h('span', { class: 'chip lv1 on' }, `还不熟 ${n[1]}`),
      h('span', { class: 'chip lv0 on' }, `不会 ${n[0]}`),
      h('span', { class: 'chip' }, `还没打分 ${none}`),
    );
  };
  syncSummary();
  let busy = false;
  const show = async (e: BookEntry) => {
    if (busy) return;
    busy = true;
    const isF2L = e.key.startsWith('f2l');
    view.setPreset(isF2L ? 'front' : 'top');
    view.setAlg(invertAlg(e.alg));
    view.highlight(isF2L ? ['DFR', 'FR'] : null);
    caption.textContent = `${e.emoji} ${load().nick[e.key] || e.name}：${e.look}`;
    const av = algView(e.alg);
    algBox.replaceChildren(av.el);
    await new Promise((r) => setTimeout(r, 700));
    await playWithArrows(view, e.alg, av.at, 300);
    busy = false;
  };

  const groups = [...new Set(BOOK.map((b) => b.group))];
  const list = h('div', { class: 'book' });
  for (const g of groups) {
    list.append(h('div', { class: 'section-title' }, g));
    const grid = h('div', { class: 'book-grid' });
    for (const e of BOOK.filter((b) => b.group === g)) {
      const nick = h('input', { type: 'text', id: `nick-${e.key}`, placeholder: '我们叫它…', value: load().nick[e.key] ?? '' }) as HTMLInputElement;
      nick.onchange = () => save((d) => (d.nick[e.key] = nick.value.trim()));
      grid.append(
        h(
          'div',
          { class: 'book-card' },
          h(
            'div',
            { class: 'book-head' },
            e.diagram ? topDiagram(e.alg, e.diagram) : h('div', { class: 'book-emoji' }, e.emoji),
            h('div', { class: 'book-meta' }, h('div', { class: 'book-name' }, `${e.emoji} ${e.name}`), h('div', { class: 'muted' }, e.look)),
          ),
          h('div', { class: 'alg' }, e.alg),
          nick,
          h('div', { class: 'book-foot' }, rater(e.key, syncSummary), h('button', { class: 'chip', onclick: () => show(e) }, '👀 看')),
        ),
      );
    }
    list.append(grid);
  }

  root.append(
    topbar('📒 公式本', '#/', summary),
    h(
      'div',
      { class: 'parent-note', style: 'margin-bottom:14px' },
      '练习时随手打分：不会 / 还不熟 / 会了。名字和您平时教的不一样的话，就在"我们叫它"里写上家里的叫法，课程和练习场里会一起用。打分会影响「好朋友回家练习场」：不会的出现得最多。',
    ),
    h('div', { class: 'player book-top' }, st.el, h('div', { class: 'side' }, caption, algBox)),
    list,
  );
  return () => view.dispose();
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
