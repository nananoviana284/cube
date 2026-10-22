import { ISLANDS, lessonsOf } from '../content/lessons';
import { CubeView } from '../cube/view';
import { load, totalStars } from '../store';
import { h, starsText } from '../ui/dom';
import { topbar } from '../ui/components';

export const GAMES = [
  { id: 'track', emoji: '🕵️', name: '跟踪小侦探', desc: '眼睛跟住一个方块' },
  { id: 'friend', emoji: '🤝', name: '快找好朋友', desc: '比比谁找得快' },
  { id: 'f2l', emoji: '🌳', name: '好朋友回家练习场', desc: '随机 F2L 情况' },
  { id: 'lights', emoji: '🚗', name: '车灯快认', desc: '一眼认 PLL' },
  { id: 'metro', emoji: '🐢', name: '乌龟节拍器', desc: '慢慢转，不要停' },
];

export function homePage(root: HTMLElement): () => void {
  const d = load();
  const cubeBox = h('div', { class: 'mini-cube' });
  root.append(
    h(
      'div',
      { class: 'hero' },
      cubeBox,
      h('div', null, h('div', { class: 'hello' }, `你好，${d.kidName}！`), h('div', { class: 'sub' }, `已经收集了 ⭐ ${totalStars()} 颗星星`)),
    ),
  );
  const view = new CubeView(cubeBox, { orbit: false });
  let alive = true;
  const spin = async () => {
    while (alive) {
      await view.play("R U R' U'", 260);
      await new Promise((r) => setTimeout(r, 400));
    }
  };
  spin();

  root.append(
    h(
      'div',
      { class: 'islands' },
      ...ISLANDS.map((is) => {
        const ls = lessonsOf(is.id);
        const got = ls.reduce((a, l) => a + (d.stars[l.id] ?? 0), 0);
        return h(
          'button',
          { class: 'island', style: `background:${is.color}`, onclick: () => (location.hash = `#/island/${is.id}`) },
          h('div', { class: 'big' }, is.emoji),
          h('div', { class: 'name' }, is.name),
          h('div', { class: 'desc' }, is.desc),
          h('div', { class: 'prog' }, `⭐ ${got} / ${ls.length * 3}`),
        );
      }),
    ),
    h('div', { class: 'section-title' }, '🎮 小游戏'),
    h(
      'div',
      { class: 'row' },
      ...GAMES.map((g) =>
        h(
          'button',
          { class: 'tile', onclick: () => (location.hash = `#/game/${g.id}`) },
          h('span', { class: 'e' }, g.emoji),
          h('span', null, g.name, h('small', null, g.desc)),
        ),
      ),
    ),
    h('div', { class: 'section-title' }, '🧰 工具'),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'tile', onclick: () => (location.hash = '#/book') }, h('span', { class: 'e' }, '📒'), h('span', null, '公式本', h('small', null, '会不会，自己打分'))),
      h('button', { class: 'tile', onclick: () => (location.hash = '#/timer') }, h('span', { class: 'e' }, '⏱️'), h('span', null, '计时器', h('small', null, '记录每一次还原'))),
      h('button', { class: 'tile', onclick: () => (location.hash = '#/lab') }, h('span', { class: 'e' }, '🧪'), h('span', null, '自由魔方', h('small', null, '输入公式看动画'))),
      h('button', { class: 'tile', onclick: () => (location.hash = '#/parent') }, h('span', { class: 'e' }, '👨‍👩‍👦'), h('span', null, '家长中心', h('small', null, '课表、进度、设置'))),
    ),
  );
  return () => {
    alive = false;
    view.dispose();
  };
}

export function islandPage(root: HTMLElement, id: string): () => void {
  const is = ISLANDS.find((i) => i.id === id);
  if (!is) {
    location.hash = '#/';
    return () => {};
  }
  const d = load();
  root.append(
    topbar(`${is.emoji} ${is.name}`, '#/'),
    h(
      'div',
      { class: 'lessons' },
      ...lessonsOf(id).map((l, i) =>
        h(
          'button',
          { class: 'lesson-card', onclick: () => (location.hash = `#/lesson/${l.id}`) },
          h('span', { class: 'n' }, String(i + 1)),
          h('span', { class: 'e' }, l.emoji),
          h('span', null, h('div', { class: 't' }, l.title), h('div', { class: 'g' }, `${l.goal} · 约 ${l.minutes} 分钟`)),
          h('span', { class: 's' }, starsText(d.stars[l.id] ?? 0)),
        ),
      ),
    ),
  );
  return () => {};
}
