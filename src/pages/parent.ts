import { LESSONS, lessonById } from '../content/lessons';
import type { Color } from '../cube/model';
import { BOOK } from './book';
import { load, save, today, weekNumber } from '../store';
import { h, starsText } from '../ui/dom';
import { topbar } from '../ui/components';
import { avgOf, chart, fmt } from './timer';

export interface Week {
  week: number;
  theme: string;
  lessons: string[];
  games: string;
  real: string;
}

export const PLAN: Week[] = [
  { week: 1, theme: '打地基：认识方块和"开门关门"', lessons: ['pieces', 'door'], games: '跟踪小侦探', real: '每天计时 3 次，记录当前水平（基线）' },
  { week: 2, theme: '找朋友 + 让路思想', lessons: ['friends', 'detour'], games: '快找好朋友', real: '还原时说出每一对好朋友在哪' },
  { week: 3, theme: '万能钥匙 1、2', lessons: ['key1', 'key2'], games: 'F2L 练习场（只练钥匙）', real: '真实还原中，第 1 对用 F2L，其余照旧' },
  { week: 4, theme: '万能钥匙 3、4', lessons: ['key3', 'key4'], games: 'F2L 练习场', real: '前 2 对用 F2L' },
  { week: 5, theme: '难情况变简单', lessons: ['tricky'], games: 'F2L 练习场（全部情况）', real: '4 对全部用 F2L（会变慢，正常！）' },
  { week: 6, theme: '先做哪一对', lessons: ['choose'], games: '乌龟节拍器 40~60', real: '十字后先说出 4 对位置再开始' },
  { week: 7, theme: '侦探眼：边做边看', lessons: ['look', 'inspect'], games: '跟踪小侦探、节拍器', real: '15 秒观察 + 计时，标记"哪里卡住"' },
  { week: 8, theme: '七步法变四步 + 黄十字', lessons: ['map7', 'ollcross'], games: '—', real: '顶层十字一次认对，不再重复做' },
  { week: 9, theme: '小鱼家族（查漏补缺）', lessons: ['fish'], games: '—', real: '在公式本里打分，每天复习"不会"的 1~2 个' },
  { week: 10, theme: '认车灯：PLL 角', lessons: ['lights'], games: '车灯快认', real: '做完 OLL 停 2 秒说出车灯在哪' },
  { week: 11, theme: 'PLL 棱：一次做对', lessons: ['edges'], games: '车灯快认', real: '顶层四步全部用新方法' },
  { week: 12, theme: '整合 + 提速', lessons: [], games: '节拍器逐步加快', real: '和第 1 周成绩对比，庆祝！' },
];

/** 按每天练习时长给出今天的安排 */
function dailyPlan(wk: number): HTMLElement {
  const w = PLAN[wk - 1];
  const lessons = w.lessons.map((id) => lessonById(id)?.title).join('、') || '复习之前的课，挑星星最少的';
  const mins = load().dailyMinutes;
  const blocks: [string, string][] =
    mins >= 60
      ? [
          ['第 1 段 · 15 分钟', `热身小游戏（${w.games}）+ 新课：${lessons}`],
          ['休息 5 分钟', '站起来活动，喝水，别看屏幕'],
          ['第 2 段 · 15 分钟', `真魔方：${w.real}`],
          ['休息 5 分钟', ''],
          ['第 3 段 · 15 分钟', '公式本：复习"不会/还不熟"的情况，练完重新打分；F2L 练习场 10 个'],
          ['最后 5 分钟', '计时器 3 次，点"哪里卡住"'],
        ]
      : mins >= 30
        ? [
            ['第 1 段 · 12 分钟', `热身小游戏 + 新课：${lessons}`],
            ['休息 3 分钟', ''],
            ['第 2 段 · 15 分钟', `真魔方：${w.real}；最后计时 3 次`],
          ]
        : [
            ['热身 3 分钟', `小游戏（${w.games}）`],
            ['新课 7 分钟', lessons],
            ['真魔方 5 分钟', w.real],
          ];
  return h(
    'table',
    null,
    ...blocks.map(([k, v]) => h('tr', null, h('td', { style: 'white-space:nowrap;font-weight:700' }, k), h('td', null, v))),
  );
}

function bookSummary(): string {
  const sk = load().skills;
  const count = (v: number) => BOOK.filter((b) => sk[b.key] === v).length;
  const weak = BOOK.filter((b) => sk[b.key] === 0).map((b) => load().nick[b.key] || b.name);
  return `会了 ${count(2)} 个，还不熟 ${count(1)} 个，不会 ${count(0)} 个，没打分 ${BOOK.length - count(0) - count(1) - count(2)} 个。${weak.length ? `接下来先练：${weak.slice(0, 4).join('、')}。` : ''}`;
}

export function parentPage(root: HTMLElement): () => void {
  const d = load();
  const wk = Math.min(weekNumber(), 12);

  const planBox = h('div', null, dailyPlan(wk));
  const nameInput = h('input', { type: 'text', value: d.kidName }) as HTMLInputElement;
  nameInput.onchange = () => save((x) => (x.kidName = nameInput.value.trim() || '小魔方'));

  const voice = h('button', { class: 'chip' + (d.voice ? ' on' : '') }, '自动朗读');
  voice.onclick = () => {
    save((x) => (x.voice = !x.voice));
    voice.classList.toggle('on', load().voice);
  };
  const speedSel = h('div', { class: 'chips' });
  const speeds: [string, number][] = [
    ['慢', 650],
    ['中', 420],
    ['快', 260],
  ];
  const syncSpeed = () =>
    speedSel.replaceChildren(
      ...speeds.map(([n, v]) => {
        const b = h('button', { class: 'chip' + (load().speed === v ? ' on' : '') }, `动画${n}`);
        b.onclick = () => {
          save((x) => (x.speed = v));
          syncSpeed();
        };
        return b;
      }),
    );
  syncSpeed();

  const frontSel = h('div', { class: 'chips' });
  const fronts: [Color, string][] = [
    ['G', '绿色朝前'],
    ['R', '红色朝前'],
    ['B', '蓝色朝前'],
    ['O', '橙色朝前'],
  ];
  frontSel.append(
    ...fronts.map(([c, n]) => {
      const b = h('button', { class: 'chip' + (load().front === c ? ' on' : '') }, n);
      b.onclick = () => {
        save((x) => (x.front = c));
        location.reload();
      };
      return b;
    }),
  );
  const pauseSel = h('div', { class: 'chips' });
  const syncPause = () =>
    pauseSel.replaceChildren(
      ...([
        [1500, '1.5 秒'],
        [2500, '2.5 秒'],
        [4000, '4 秒'],
      ] as [number, string][]).map(([v, n]) => {
        const b = h('button', { class: 'chip' + (load().followPause === v ? ' on' : '') }, n);
        b.onclick = () => {
          save((x) => (x.followPause = v));
          syncPause();
        };
        return b;
      }),
    );
  syncPause();
  const minutesSel = h('div', { class: 'chips' });
  const syncMinutes = () =>
    minutesSel.replaceChildren(
      ...[15, 30, 60].map((m) => {
        const b = h('button', { class: 'chip' + (load().dailyMinutes === m ? ' on' : '') }, `${m} 分钟`);
        b.onclick = () => {
          save((x) => (x.dailyMinutes = m));
          syncMinutes();
          planBox.replaceChildren(dailyPlan(wk));
        };
        return b;
      }),
    );
  syncMinutes();

  // 打卡
  const t = today();
  const practiceRow = h('div', { class: 'chips' });
  const syncPractice = () =>
    practiceRow.replaceChildren(
      ...[0, 15, 30, 45, 60].map((m) => {
        const b = h('button', { class: 'chip' + (load().practice[t] === m ? ' on' : '') }, m ? `${m} 分钟` : '今天休息');
        b.onclick = () => {
          save((x) => (x.practice[t] = m));
          syncPractice();
        };
        return b;
      }),
    );
  syncPractice();
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(Date.now() - (13 - i) * 86400000);
    const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return d.practice[k] ? '🟩' : '⬜';
  }).join('');

  const ss = d.solves;
  const a5 = avgOf(ss, 5);
  const first5 = ss.length >= 5 ? avgOf(ss.slice(0, 5), 5) : null;
  const noteCount: Record<string, number> = {};
  for (const s of ss.slice(-30)) if (s.note) noteCount[s.note] = (noteCount[s.note] ?? 0) + 1;
  const topNotes = Object.entries(noteCount)
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `${n} ×${c}`)
    .join('、');

  root.append(
    topbar('👨‍👩‍👦 家长中心', '#/'),
    h(
      'div',
      { class: 'panel' },
      h('h2', null, '📅 今天练什么'),
      h('p', null, h('b', null, `第 ${wk} 周：${PLAN[wk - 1].theme}`)),
      planBox,
      h('p', { class: 'muted' }, '孩子还想玩的时候就停，比练到烦了再停效果好得多。5 岁孩子一次专注大约 15 分钟，所以一小时要拆成几段，中间站起来活动一下。'),
      h('h3', null, '今天练了多久？'),
      practiceRow,
      h('p', { class: 'muted' }, `最近 14 天：${last14}`),
    ),
    h(
      'div',
      { class: 'panel' },
      h('h2', null, '🧭 这套训练的思路'),
      h('div', {
        html: `
<p><b>不背公式，学"为什么"。</b>孩子目前的瓶颈是 F2L（两层一起做）和顶层还在用七步法。这两件事本质上都不需要大量背公式：</p>
<p><b>① 三个核心原理（第 1~2 周）</b><br>
· <b>看方块，不看贴纸</b>：角块 3 色、棱块 2 色，永远一起走；中心块决定颜色。<br>
· <b>开门-做事-关门</b>（R U R'）：借走底层一块，做完原样还回来，所以只影响顶层。F2L 所有走法都是它。<br>
· <b>让路-做事-还原</b>（A B A'）：先把挡路的东西挪开，做完再挪回来。这是高手所有"技巧"的底层结构。</p>
<p><b>② F2L = 4 把万能钥匙 + "先变简单"（第 3~6 周）</b><br>
不学 41 个公式。只学 4 种最基础的情况，其余情况都先"把两块请到顶层"变成这 4 种。熟练后，孩子会自己发现更短的走法——这才是真正的直觉 F2L。</p>
<p><b>③ 观察 = 提前看（第 7 周起贯穿）</b><br>
高手快不是因为手快，而是"手不停"：做这一对的时候眼睛已经在找下一对。训练方法：跟踪游戏（眼睛跟住方块）、15 秒观察（开始前就规划十字）、节拍器（强迫慢而不停）。</p>
<p><b>④ 顶层：从"重复做直到好"到"认出来就做对"（第 8~11 周）</b><br>
七步法的顶层 ≈ CFOP 的两步 OLL + 两步 PLL。升级的关键是<b>识别</b>：黄十字认形状、顶面认小鱼、PLL 认车灯。公式总数只多 6~8 个（T、Y、H、Z 等）。</p>
<p><b>⑤ 预期管理</b>：换成 F2L 的头 2~3 周，还原时间会<b>变慢</b>（可能到 1 分半），这是正常的"换挡期"，请提前告诉孩子"变慢说明在学新本领"。一般第 6~8 周会追平并超过原来的速度。</p>`,
      }),
    ),
    h(
      'div',
      { class: 'panel' },
      h('h2', null, '🗓️ 12 周课表'),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          null,
          h('tr', null, h('th', null, '周'), h('th', null, '主题'), h('th', null, '课'), h('th', null, '游戏'), h('th', null, '真魔方')),
          ...PLAN.map((w) =>
            h(
              'tr',
              { class: w.week === wk ? 'now' : '' },
              h('td', null, String(w.week)),
              h('td', null, w.theme),
              h('td', null, w.lessons.map((id) => lessonById(id)?.title).join('、') || '—'),
              h('td', null, w.games),
              h('td', null, w.real),
            ),
          ),
        ),
      ),
      h(
        'p',
        { class: 'muted' },
        '课表从第一次打开网页那天开始算。节奏可以按孩子情况调整：一周的内容没掌握就多停一周。',
        h('button', {
          class: 'chip',
          style: 'margin-left:8px',
          onclick: () => {
            if (confirm('把今天设为第 1 周的开始？')) {
              save((x) => (x.startedAt = Date.now()));
              location.reload();
            }
          },
        }, '从今天重新开始算'),
      ),
    ),
    h(
      'div',
      { class: 'panel' },
      h('h2', null, '⭐ 闯关进度'),
      h(
        'table',
        null,
        ...LESSONS.map((l) => h('tr', null, h('td', null, `${l.emoji} ${l.title}`), h('td', { style: 'color:#f4a100;white-space:nowrap' }, starsText(d.stars[l.id] ?? 0)))),
      ),
    ),
    h(
      'div',
      { class: 'panel' },
      h('h2', null, '⏱️ 成绩'),
      h(
        'p',
        null,
        `一共 ${ss.length} 次。`,
        a5 !== null ? `最近 5 次平均 ${fmt(a5)}。` : '',
        first5 !== null && a5 !== null ? `最早 5 次平均 ${fmt(first5)}。` : '',
      ),
      topNotes ? h('p', null, `最近常卡在：${topNotes}`) : h('p', { class: 'muted' }, '计时后点"哪里卡住"，这里会统计出孩子最需要练的环节。'),
      h('div', { class: 'chart' }, chart(ss)),
    ),
    h(
      'div',
      { class: 'panel' },
      h('h2', null, '📒 公式本：会不会'),
      h('p', null, bookSummary()),
      h('p', { class: 'muted' }, '每个情况都有图和动画，可以写上家里的叫法，并打分"不会 / 还不熟 / 会了"。打分会让练习场多出"不会"的情况。'),
      h('button', { class: 'btn blue', onclick: () => (location.hash = '#/book') }, '打开公式本'),
    ),
    h(
      'div',
      { class: 'panel' },
      h('h2', null, '⚙️ 设置'),
      h('p', null, '孩子的名字：', nameInput),
      h('div', { class: 'chips' }, voice),
      h('div', { style: 'margin-top:8px' }, speedSel),
      h('h3', null, '"跟着做"每一步停多久'),
      pauseSel,
      h('h3', null, '朝前的颜色'),
      frontSel,
      h('h3', null, '每天练习时间'),
      minutesSel,
      h('p', { class: 'muted' }, '白色永远在底、黄色在顶。朝前的颜色可以换：大多数 CFOP 教程用绿色朝前；学过桥式法的话，红色朝前可能更顺手。建议选定一个后固定下来，这样孩子会形成"颜色的位置感"，观察会更快。数据只保存在这台设备的浏览器里。'),
      h(
        'div',
        { class: 'chips' },
        h('button', {
          class: 'chip',
          onclick: () => {
            const blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `cube-coach-${today()}.json` });
            a.click();
          },
        }, '导出记录'),
      ),
    ),
  );
  return () => {};
}
