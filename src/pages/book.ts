import { applyAlg, invertAlg, stateFrom } from '../cube/alg';
import { mirrorAlg } from '../content/slots';
import { F2L_CASES, OLL_CORNERS, OLL_EDGES, PLL_CORNERS, PLL_EDGES, joinSteps, type Step } from '../content/algs';
import { load, save } from '../store';
import { beep, h, speak } from '../ui/dom';
import { stateDiagram, topDiagram, type DiagramMode } from '../ui/diagram';
import { algView, keyBtn, pageHeader, playWithArrows, stage, tabbar } from '../ui/components';
import { icon } from '../ui/icons';
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
}

export const BOOK: BookEntry[] = [
  ...F2L_CASES.map((c) => ({
    key: `f2l-${c.id}`,
    group: 'F2L 好朋友回家',
    name: c.name,
    emoji: c.emoji,
    look: c.look,
    alg: joinSteps(c.steps),
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

/** 分组名字和颜色，和闯关地图的岛一致 */
const GROUP_LOOK: Record<string, [string, string]> = {
  'F2L 好朋友回家': ['好朋友回家', '#12A150'],
  'OLL 第一步：黄十字': ['黄十字', '#E5383B'],
  'OLL 第二步：顶面全黄': ['顶面全黄', '#E5383B'],
  'PLL：侧面排好': ['侧面排好', '#E5383B'],
};

const nameOf = (e: BookEntry) => load().nick[e.key] || e.name;

/** 公式本：分组看卡片——图、公式、会不会；点"看"在右边（手机上从底部弹出）演示 */
export function bookPage(root: HTMLElement): () => void {
  const groups = [...new Set(BOOK.map((b) => b.group))];
  let group = groups[0];
  let onlyWeak = false;
  let selected: BookEntry = BOOK[0];
  let playGen = 0;

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

  // 演示区
  const st = stage('top');
  const { view } = st;
  const pvName = h('div', { class: 'book-name' });
  const pvLook = h('div', { class: 'book-look' });
  const algBox = h('div');
  const pvKin = h('div', { class: 'book-kin' });
  const nick = h('input', { type: 'text', placeholder: '比如：大眼睛' }) as HTMLInputElement;
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const preview = h(
    'aside',
    { class: 'book-preview', 'aria-label': '演示' },
    h('span', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    h('div', { class: 'sheet-head' }, h('div', null, pvName, pvLook), h('button', { class: 'sheet-close', type: 'button', 'aria-label': '关闭', onclick: () => closeSheet() }, icon('close', 20))),
    st.el,
    algBox,
    pvKin,
    h('div', { class: 'pv-row' }, h('label', { class: 'nick-field' }, '我们家叫它', nick), keyBtn('btn green', '再看一遍', '空格', () => play(selected), 'replay')),
  );
  const closeSheet = () => {
    preview.classList.remove('open');
    backdrop.classList.remove('open');
  };
  backdrop.onclick = closeSheet;
  nick.onchange = () => {
    save((d) => (d.nick[selected.key] = nick.value.trim()));
    pvName.textContent = nameOf(selected);
    renderGrid();
  };

  const pose = (e: BookEntry) => {
    const isF2L = e.key.startsWith('f2l');
    view.setPreset(isF2L ? 'front' : 'top');
    view.setAlg(invertAlg(e.alg));
    view.highlight(isF2L ? ['DFR', 'FR'] : null);
    pvName.textContent = nameOf(e);
    pvLook.textContent = e.look;
    pvKin.replaceChildren(...kinView(e));
    nick.value = load().nick[e.key] ?? '';
    const av = algView(e.alg);
    algBox.replaceChildren(av.el);
    return av;
  };
  /** 亲戚：一句话 + 拼起来的一步步图 + 可以点过去的亲戚 */
  const kinView = (e: BookEntry): Node[] => {
    if (!e.kin) return [];
    const out: Node[] = [h('div', { class: 'kin-title' }, `亲戚：${e.kin}`)];
    if (e.diagram === 'edges') out.push(h('div', { class: 'kin-note' }, '黄十字这一步只看四个棱块（十字的位置）。角块画成虚线，先不用管。'));
    const mode = e.diagram ?? 'oll';
    if (e.chain) {
      const s = stateFrom(invertAlg(e.alg));
      const row = h('div', { class: 'kin-chain' }, h('figure', null, stateDiagram(s, mode), h('figcaption', null, nameOf(e))));
      for (const step of e.chain) {
        applyAlg(s, step.moves);
        row.append(h('div', { class: 'kin-arrow' }, h('span', { class: 'alg' }, step.moves), '→'), h('figure', null, stateDiagram(s, mode), h('figcaption', null, (step.say.split('：')[1] ?? step.say.split('，')[0]).replace(/[！。]$/, ''))));
      }
      out.push(row, keyBtn('btn blue', '一段一段看', '2', () => playChain(e), 'play'));
    }
    if (e.rel)
      out.push(
        h(
          'div',
          { class: 'kin-rel' },
          ...e.rel.map((r) => {
            const t = BOOK.find((b) => b.key === r.to);
            if (!t) return null;
            return h('button', { class: 'kin-link', type: 'button', onclick: () => show(t) }, t.diagram ? topDiagram(t.alg, t.diagram) : null, h('span', null, `${r.label} → ${nameOf(t)}`));
          }),
        ),
      );
    return out;
  };
  /** 拼起来的公式：每做一段停一下，念出变成了什么 */
  const playChain = async (e: BookEntry) => {
    if (!e.chain) return;
    const my = ++playGen;
    pose(e);
    await new Promise((r) => setTimeout(r, 500));
    for (const step of e.chain) {
      if (my !== playGen) return;
      await playWithArrows(view, step.moves, undefined, 300);
      if (my !== playGen) return;
      await speak(step.say);
    }
  };
  const play = async (e: BookEntry) => {
    const my = ++playGen;
    const av = pose(e);
    await new Promise((r) => setTimeout(r, 600));
    if (my !== playGen) return;
    await playWithArrows(view, e.alg, (i) => my === playGen && av.at(i), 300);
  };
  const show = (e: BookEntry) => {
    selected = e;
    renderGrid();
    preview.classList.add('open');
    backdrop.classList.add('open');
    play(e);
  };

  const tabs = h('div', { class: 'book-tabs', role: 'tablist', 'aria-label': '公式分组' });
  const syncTabs = () =>
    tabs.replaceChildren(
      ...groups.map((g) => {
        const [label, color] = GROUP_LOOK[g] ?? [g, '#5A5F7A'];
        const count = BOOK.filter((b) => b.group === g).length;
        return h(
          'button',
          {
            class: g === group ? 'book-tab on' : 'book-tab',
            type: 'button',
            role: 'tab',
            'aria-selected': String(g === group),
            onclick: () => {
              group = g;
              syncTabs();
              renderGrid();
            },
          },
          h('i', { style: `background:${color}` }),
          `${label} ${count}`,
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

  const grid = h('div', { class: 'book-grid' });
  function renderGrid(): void {
    const sk = load().skills;
    const list = BOOK.filter((b) => b.group === group && (!onlyWeak || sk[b.key] === 0));
    grid.replaceChildren(
      ...(list.length ? [] : [h('p', { class: 'muted' }, '这一组没有"不会"的，真棒！')]),
      ...list.map((e) =>
        h(
          'article',
          { class: e === selected ? 'book-card sel' : 'book-card' },
          h(
            'div',
            { class: 'book-head' },
            e.diagram ? topDiagram(e.alg, e.diagram) : h('div', { class: 'book-emoji', 'aria-hidden': 'true' }, icon('pair', 34)),
            h('div', { class: 'book-meta' }, h('div', { class: 'book-name' }, nameOf(e)), h('div', { class: 'book-look' }, e.look), h('div', { class: 'book-alg' }, e.alg), e.kin ? h('div', { class: 'book-kin' }, `亲戚：${e.kin}`) : null),
          ),
          h(
            'div',
            { class: 'book-foot' },
            rater(e.key, () => {
              syncSummary();
              if (onlyWeak) renderGrid();
            }),
            h('button', { class: 'look-btn', type: 'button', onclick: () => show(e), 'aria-label': `看${e.name}的动画` }, icon('play', 14), e === selected ? '正在看' : '看'),
          ),
        ),
      ),
    );
  }

  syncSummary();
  syncTabs();
  renderGrid();
  pose(selected);
  setKeys({ space: () => play(selected), '2': () => playChain(selected), esc: () => (location.hash = '#/') });
  root.append(
    pageHeader('公式本', undefined, summary),
    tabs,
    h('main', { class: 'book-layout' }, grid, preview),
    backdrop,
    tabbar('book'),
  );
  return () => {
    playGen++;
    view.dispose();
  };
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
