import { applyAlg, invertAlg, parseAlg, stateFrom } from '../cube/alg';
import { anglesOf, effectOf, effectText } from '../content/effect';
import { load, save } from '../store';
import { h, speak } from '../ui/dom';
import { stateDiagram, topDiagram } from '../ui/diagram';
import { algView, kbd, keyBtn, stage, topbar } from '../ui/components';
import { icon } from '../ui/icons';
import { setKeys } from '../ui/keys';
import { BOOK, GROUP_LOOK, nameOf, rater, type BookEntry } from './book';

/**
 * 公式详情页：左边魔方演示，右边讲清楚——
 * 这个公式做什么（翻了哪块、谁去哪）、认出它看哪里、不同角度怎么拨、每一步在干什么、和谁是亲戚。
 */
export function formulaPage(root: HTMLElement, key: string): () => void {
  const e = BOOK.find((b) => b.key === key);
  if (!e) {
    location.hash = '#/';
    return () => {};
  }
  const siblings = BOOK.filter((b) => b.group === e.group);
  const idx = siblings.indexOf(e);
  const go = (d: number) => {
    const t = siblings[idx + d];
    if (t) location.replace(`#/f/${t.key}`);
  };
  const isF2L = !e.diagram;
  let playGen = 0;

  const st = stage(isF2L ? 'front' : 'top');
  const { view } = st;
  const av = algView(e.alg);
  const pose = () => {
    view.setPreset(isF2L ? 'front' : 'top');
    view.setAlg(invertAlg(e.alg));
    view.highlight(isF2L ? ['DFR', 'FR'] : null);
    av.at(-1);
  };
  // 播放 / 暂停 / 继续：同一个按钮（空格）。恢复：回到一开始的样子（2）。
  let state: 'idle' | 'playing' | 'paused' | 'done' = 'idle';
  let resume: (() => void) | null = null;
  const playBtn = h('button', { class: 'btn green', type: 'button', onclick: () => toggle() });
  const syncBtn = () => {
    const [label, ic] =
      state === 'playing' ? ['暂停', 'stop'] : state === 'paused' ? ['继续', 'play'] : state === 'done' ? ['再看一遍', 'replay'] : ['播放', 'play'];
    playBtn.replaceChildren(icon(ic as 'stop', 22), h('span', { class: 'lbl' }, label), kbd('空格'));
  };
  const setState = (v: typeof state) => {
    state = v;
    syncBtn();
  };
  const play = async () => {
    const my = ++playGen;
    resume?.();
    resume = null;
    pose();
    setState('playing');
    await new Promise((r) => setTimeout(r, 500));
    const moves = parseAlg(e.alg).map((m) => m.text);
    for (let i = 0; i < moves.length; i++) {
      // 暂停：等这一步做完，停在这里，按继续再往下
      if (state === 'paused') await new Promise<void>((r) => (resume = r));
      if (my !== playGen) return;
      av.at(i);
      view.showArrow(moves[i]);
      view.onMove?.(moves[i]);
      await Promise.all([new Promise((r) => setTimeout(r, 300)), speak(moves[i])]);
      view.showArrow(null);
      if (my !== playGen) return;
      await view.play(moves[i]);
      if (my !== playGen) return;
    }
    av.at(moves.length);
    setState('done');
  };
  const toggle = () => {
    if (state === 'playing') setState('paused');
    else if (state === 'paused') {
      setState('playing');
      resume?.();
      resume = null;
    } else play();
  };
  /** 恢复：停下来，回到一开始的样子 */
  const restore = () => {
    playGen++;
    resume?.();
    resume = null;
    view.showArrow(null);
    pose();
    setState('idle');
  };

  const nick = h('input', { type: 'text', placeholder: '比如：大眼睛', value: load().nick[e.key] ?? '' }) as HTMLInputElement;
  nick.onchange = () => save((d) => (d.nick[e.key] = nick.value.trim()));

  const [groupLabel, groupColor] = GROUP_LOOK[e.group] ?? [e.group, '#5A5F7A'];
  const demo = h(
    'section',
    { class: 'fd-demo' },
    st.el,
    av.el,
    h(
      'div',
      { class: 'fd-actions' },
      playBtn,
      keyBtn('btn ghost', '恢复', '2', restore, 'replay'),
    ),
    h('div', { class: 'fd-rate' }, h('span', null, '会不会'), rater(e.key)),
    h('label', { class: 'nick-field' }, '我们家叫它', nick),
  );

  const info = h('section', { class: 'fd-info' }, ...effectCards(e), ...stepCards(e), ...kinCards(e));

  const nav = h(
    'div',
    { class: 'fd-nav' },
    h('span', { class: 'fd-group' }, h('i', { style: `background:${groupColor}` }), `${groupLabel} · ${idx + 1} / ${siblings.length}`),
    keyBtn('btn ghost', '上一个', '←', () => go(-1), 'left'),
    keyBtn('btn ghost', '下一个', '→', () => go(1), 'right'),
  );

  root.append(topbar(nameOf(e), '#/', nav), h('p', { class: 'fd-look' }, e.look), h('main', { class: 'fd-layout' }, demo, info));
  setKeys({ space: toggle, '2': restore, left: () => go(-1), right: () => go(1), esc: () => (location.hash = '#/') });
  // 进来先停在一开始的样子，孩子看清楚了自己按播放
  pose();
  setState('idle');
  return () => {
    playGen++;
    resume?.();
    view.dispose();
  };
}

const card = (title: string, ...body: (Node | null)[]) => h('div', { class: 'fd-card' }, h('h2', null, title), ...body);

/** 这个公式做什么 + 认出它看哪里 + 不同角度 */
function effectCards(e: BookEntry): Node[] {
  if (!e.diagram) return [];
  const mode = e.diagram;
  const s = stateFrom(invertAlg(e.alg));
  const ef = effectOf(s, mode);
  const legend =
    mode === 'pll'
      ? '蓝色箭头：每一块要去的地方。'
      : mode === 'edges'
        ? '转圈箭头：会翻上来的棱块。虚线的角块这一步不用管。'
        : '转圈箭头：会拧正的角块。';
  const cueText =
    mode === 'pll' ? '蓝框是车灯：同一面两个角颜色一样。' : mode === 'edges' ? '蓝框是已经朝上的黄色棱块，看它们摆成什么形状。' : '蓝框是侧面的黄色，看它们在哪里。';
  const angles = anglesOf(e.alg, mode);
  return [
    card(
      '这个公式做什么',
      h(
        'div',
        { class: 'fd-effect' },
        stateDiagram(s, mode, { spins: [...ef.flips, ...ef.twists], arrows: ef.moves, cues: ef.cues }),
        h('div', null, h('p', { class: 'fd-big' }, effectText(ef, mode)), h('p', { class: 'muted' }, legend), h('h3', null, '认出它要看哪里'), h('p', null, `${e.look}。${cueText}`)),
      ),
    ),
    card(
      angles.length > 1 ? `遇到不同角度（${angles.length} 种）` : '遇到不同角度',
      angles.length > 1
        ? h('p', { class: 'muted' }, '都是同一个情况，只是顶层转了。先拨一下，摆成第一个的样子，再做同一个公式。拨一下几乎不花时间。')
        : h('p', { class: 'muted' }, '这个情况转到哪个角度看起来都一样，不用拨，直接做。'),
      angles.length > 1
        ? h(
            'div',
            { class: 'fd-angles' },
            ...angles.map((a) =>
              h('figure', null, stateDiagram(a.state, mode, { cues: effectOf(a.state, mode).cues }), h('figcaption', null, a.pre ? h('span', null, '先拨 ', h('b', { class: 'alg' }, a.pre)) : '直接做')),
            ),
          )
        : null,
    ),
  ];
}

/** 每一步在做什么：F2L 的开门-做事-关门，或者拼起来的公式一段一段变成什么样 */
function stepCards(e: BookEntry): Node[] {
  if (e.steps)
    return [
      card(
        '每一步在做什么',
        h('ol', { class: 'fd-steps' }, ...e.steps.map((s) => h('li', null, h('b', { class: 'alg' }, s.moves), h('span', null, s.say)))),
      ),
    ];
  if (e.chain) {
    const mode = e.diagram ?? 'oll';
    const s = stateFrom(invertAlg(e.alg));
    const row = h('div', { class: 'kin-chain' }, h('figure', null, stateDiagram(s, mode), h('figcaption', null, nameOf(e))));
    for (const step of e.chain) {
      applyAlg(s, step.moves);
      row.append(
        h('div', { class: 'kin-arrow' }, h('span', { class: 'alg' }, step.moves), '→'),
        h('figure', null, stateDiagram(s, mode), h('figcaption', null, (step.say.split('：')[1] ?? step.say.split('，')[0]).replace(/[！。]$/, ''))),
      );
    }
    return [card('拼起来的：一段一段变成什么样', row)];
  }
  return [];
}

/** 亲戚：一句话 + 点得过去的亲戚卡片 */
function kinCards(e: BookEntry): Node[] {
  if (!e.kin) return [];
  return [
    card(
      '亲戚',
      h('p', null, e.kin),
      e.rel
        ? h(
            'div',
            { class: 'kin-rel' },
            ...e.rel.map((r) => {
              const t = BOOK.find((b) => b.key === r.to);
              if (!t) return null;
              return h('a', { class: 'kin-link', href: `#/f/${t.key}` }, t.diagram ? topDiagram(t.alg, t.diagram) : null, h('span', null, `${r.label} → ${nameOf(t)}`));
            }),
          )
        : null,
    ),
  ];
}
