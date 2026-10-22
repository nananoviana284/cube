import { ISLANDS, LESSONS, lessonsOf, type Lesson } from '../content/lessons';
import { CubeView } from '../cube/view';
import { didToday, load, solvesToday, totalStars, weekNumber } from '../store';
import { setKeys } from '../ui/keys';
import { h, speak } from '../ui/dom';
import { kbd, parentLock, starRow, tabbar } from '../ui/components';
import { icon, type IconName } from '../ui/icons';

/** 四个岛 = 魔方的四个面的颜色 */
export const ISLAND_LOOK: Record<string, { color: string; ink: string; icon: IconName }> = {
  secret: { color: '#FFC928', ink: '#1E2240', icon: 'cube' },
  f2l: { color: '#12A150', ink: '#FFFFFF', icon: 'pair' },
  eyes: { color: '#2468E8', ink: '#FFFFFF', icon: 'eye' },
  top: { color: '#E5383B', ink: '#FFFFFF', icon: 'castle' },
};

/** 继续学习：还没拿到星星的第一课；全部有星星了就挑星星最少的 */
export function nextLesson(): Lesson {
  const d = load();
  return LESSONS.find((l) => !d.stars[l.id]) ?? [...LESSONS].sort((a, b) => (d.stars[a.id] ?? 0) - (d.stars[b.id] ?? 0))[0];
}

export function starsPill(): HTMLElement {
  const n = totalStars();
  return h('div', { class: 'stars-pill', 'aria-label': `一共 ${n} 颗星星` }, icon('star', 28), String(n));
}

let greeted = false;

export function homePage(root: HTMLElement): () => void {
  const d = load();
  const next = nextLesson();
  const nextIsland = ISLANDS.find((i) => i.id === next.island)!;
  const nextIndex = lessonsOf(next.island).findIndex((l) => l.id === next.id);
  const go = () => (location.hash = `#/lesson/${next.id}`);

  // 今天的三件事：孩子看勾就懂
  const todo: [string, boolean][] = [
    ['上课', didToday('lesson')],
    ['小游戏', didToday('game')],
    ['计时 3 次', solvesToday() >= 3],
  ];
  const header = h(
    'header',
    { class: 'home-head' },
    h('div', null, h('div', { class: 'hello' }, `你好，${d.kidName}！`), h('div', { class: 'hello-sub' }, `第 ${Math.min(weekNumber(), 12)} 周 · 每天一点点，就会越来越快`)),
    h(
      'div',
      { class: 'today', 'aria-label': '今天的任务' },
      ...todo.map(([t, done]) => h('div', { class: done ? 'today-chip done' : 'today-chip' }, h('span', { class: 'dot' }, done ? icon('check', 18) : null), t)),
    ),
    h('div', { class: 'home-right' }, starsPill(), parentLock('center')),
  );

  const cubeBox = h('div', { class: 'cc-cube' });
  const look = ISLAND_LOOK[next.island];
  const card = h(
    'section',
    { class: 'continue-card' },
    h('div', { class: 'cc-chip' }, h('i', { style: `background:${look.color}` }), `${nextIsland.name} · 第 ${nextIndex + 1} 课`),
    h('h2', null, next.title),
    h('p', null, next.goal),
    cubeBox,
    h('button', { class: 'cc-start', type: 'button', onclick: go }, icon('play', 30), '开始', kbd('空格')),
  );

  const map = h(
    'section',
    { class: 'map', 'aria-label': '原理' },
    h('div', { class: 'map-head' }, h('h2', null, '原理：公式背后的道理'), h('span', { class: 'muted' }, '点任意一课都能进')),
    ...ISLANDS.map((is) => {
      const ls = lessonsOf(is.id);
      const got = ls.reduce((a, l) => a + (d.stars[l.id] ?? 0), 0);
      const lk = ISLAND_LOOK[is.id];
      const nodes: Node[] = [];
      ls.forEach((l, i) => {
        const stars = d.stars[l.id] ?? 0;
        const now = l.id === next.id;
        if (i > 0) nodes.push(h('span', { class: (d.stars[ls[i - 1].id] ?? 0) > 0 ? 'link done' : 'link' }));
        nodes.push(
          h(
            'div',
            { class: 'node-wrap' },
            h(
              'a',
              {
                href: `#/lesson/${l.id}`,
                class: now ? 'node now' : stars ? 'node done' : 'node',
                'aria-label': `第 ${i + 1} 课 ${l.title}${now ? '，现在在这里' : stars ? `，${stars} 颗星` : ''}`,
                title: l.title,
              },
              String(i + 1),
            ),
            now ? h('span', { class: 'now-tag' }, '现在') : stars ? starRow(stars, 3, 14) : null,
          ),
        );
      });
      return h(
        'div',
        { class: 'island-row', style: `--isl:${lk.color};--isl-ink:${lk.ink}` },
        h('div', { class: 'island-badge' }, h('span', { class: 'isl-ic' }, icon(lk.icon, 24)), h('div', null, h('div', { class: 'isl-name' }, is.name), h('div', { class: 'isl-prog' }, `${got} / ${ls.length * 3} 星`))),
        h('div', { class: 'nodes' }, ...nodes),
      );
    }),
  );

  root.append(header, h('main', { class: 'home-main' }, card, map), tabbar('home'));
  setKeys({ space: go });
  if (!greeted) speak(`你好，${d.kidName}！按空格，继续学习。`);
  greeted = true;

  const view = new CubeView(cubeBox, { orbit: false });
  let alive = true;
  const spin = async () => {
    while (alive) {
      await view.play("R U R' U'", 260);
      await new Promise((r) => setTimeout(r, 400));
    }
  };
  spin();
  return () => {
    alive = false;
    view.dispose();
  };
}

/** 旧的岛页面已经并进首页地图，老链接直接回首页 */
export function islandPage(): () => void {
  location.replace('#/learn');
  return () => {};
}
