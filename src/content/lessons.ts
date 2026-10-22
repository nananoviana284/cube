import { invertAlg, randomScramble } from '../cube/alg';
import { faceName as C, type CubeState } from '../cube/model';
import { F2L_CASES, OLL_CORNERS, OLL_EDGES, PLL_CORNERS, PLL_EDGES, joinSteps, type F2LCase, type Step } from './algs';
import { pick } from '../ui/dom';

// 课程 = 一串"场景"。每节 5~8 分钟，正好是 5 岁孩子专注的长度。

/** 真魔方练习的一道题：先摆 setup，再用 solution 还原 */
export interface DrillCase {
  setup: string;
  solution: string;
}

export type Scene =
  | { kind: 'talk'; say: string; setup?: string | (() => string); highlight?: string[]; view?: 'front' | 'top'; secret?: boolean }
  | { kind: 'watch'; say: string; setup: string | (() => string); highlight?: string[]; steps: Step[]; view?: 'front' | 'top' }
  | {
      /** 真魔方练习：屏幕出题 → 孩子在自己的魔方上摆好 → 空格计时 → 用真魔方做 → 自己说成功没有 */
      kind: 'drill';
      say: string;
      /** 第 rep 次（从 0 开始）的题 */
      cases: (rep: number) => DrillCase;
      highlight?: string[];
      reps: number;
    }
  | { kind: 'pick'; say: string; setup: string | (() => string); highlight?: string[]; answer: (s: CubeState) => string[]; rounds?: number }
  | {
      kind: 'quiz';
      say: string;
      setup?: string | (() => string);
      highlight?: string[];
      view?: 'front' | 'top';
      options: { label: string; ok: boolean }[] | (() => { setup: string; options: { label: string; ok: boolean }[] });
      rounds?: number;
    }
  | { kind: 'real'; say: string; checklist?: string[]; parentSetup?: string };

export interface Lesson {
  id: string;
  island: string;
  emoji: string;
  title: string;
  /** 一句话告诉孩子这一课学什么 */
  goal: string;
  minutes: number;
  /** 给家长看：这一课在练什么底层能力、怎么带 */
  parent: string;
  /** 这一课的底层原理，用孩子听得懂的话；课的最后念给孩子听 */
  secret: string;
  scenes: Scene[];
}

export interface Island {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  color: string;
}

export const ISLANDS: Island[] = [
  { id: 'secret', emoji: '🏝️', name: '魔方的秘密', desc: '方块、开门关门、让路', color: '#ffd166' },
  { id: 'f2l', emoji: '🌳', name: '好朋友回家', desc: 'F2L：两层一起做', color: '#06d6a0' },
  { id: 'eyes', emoji: '🔍', name: '侦探眼睛', desc: '观察和提前看', color: '#4cc9f0' },
  { id: 'top', emoji: '🏰', name: '顶层城堡', desc: 'OLL / PLL', color: '#f78fb3' },
];

const SLOT_PIECES = ['DFR', 'FR'];
const randU = () => pick(['', 'U', "U'", 'U2']);
const caseSetup = (c: F2LCase, auf = true) => () => `${invertAlg(joinSteps(c.steps))} ${auf ? randU() : ''}`.trim();
const caseById = (id: string) => F2L_CASES.find((c) => c.id === id)!;

/** 一个 F2L 情况出题：rep 0 用标准位置，之后随机转一下顶层（要先转 U 对准） */
const f2lDrill =
  (c: F2LCase) =>
  (rep: number): DrillCase => {
    const alg = joinSteps(c.steps);
    const auf = rep === 0 ? '' : pick(['U', "U'", 'U2']);
    return { setup: `${invertAlg(alg)} ${auf}`.trim(), solution: `${auf ? invertAlg(auf) + ' ' : ''}${alg}` };
  };
const fixedDrill = (solution: string) => (): DrillCase => ({ setup: invertAlg(solution), solution });

/** 底层白十字 + 前两层完成时，顶层的打乱（只打乱顶层） */
const llScramble = (alg: string) => `${invertAlg(alg)} ${randU()}`.trim();

/** 角块对应的"好朋友"棱块：去掉 U/D 字母 */
export const partnerOf = (cornerId: string) => cornerId.replace(/[UD]/, '');

function basicLesson(id: string, caseId: string, title: string, secret: string): Lesson {
  const c = caseById(caseId);
  return {
    id,
    island: 'f2l',
    emoji: c.emoji,
    title,
    goal: `学会万能钥匙「${c.name}」`,
    minutes: 6,
    secret,
    parent: `这一招的本质：${c.steps.map((s) => s.say.split('：')[0]).join(' → ')}。让孩子用嘴说出每一步"在干什么"，比背字母重要。练到看到这个情况 2 秒内能出手就过关。`,
    scenes: [
      { kind: 'talk', say: `认一认：${c.look}亮着的就是这对好朋友。`, setup: caseSetup(c, false), highlight: SLOT_PIECES },
      { kind: 'watch', say: '看我做，每一步都有原因。', setup: caseSetup(c, false), highlight: SLOT_PIECES, steps: c.steps },
      {
        kind: 'drill',
        say: '拿出你的魔方！先跟着屏幕摆出这个情况，再用万能钥匙让好朋友回家。做 3 次，后面两次位置会变，要先转顶层对好。',
        cases: f2lDrill(c),
        highlight: SLOT_PIECES,
        reps: 3,
      },
    ],
  };
}

export const LESSONS: Lesson[] = [
  // ———————————— 岛 1：魔方的秘密 ————————————
  {
    id: 'pieces',
    island: 'secret',
    emoji: '🧊',
    title: '魔方是一群小方块',
    goal: '知道角块、棱块、中心块',
    minutes: 5,
    parent:
      '高手和普通人的第一个区别：普通人看"颜色贴纸"，高手看"方块"。一个角块有 3 种颜色、一个棱块有 2 种颜色，它们永远一起走。中心块不会移动，它决定这一面是什么颜色。后面所有的观察技巧都建立在这个认识上。',
    secret: '魔方不是一张张贴纸，是一个个小方块。角块有三个颜色，棱块有两个颜色，它们的颜色粘在一起，永远一起走。中心块从来不动，它说了算：这一面是什么颜色。',
    scenes: [
      { kind: 'talk', say: '魔方不是 54 张贴纸，它是 26 个小方块。我们一起认识它们！', setup: '' },
      { kind: 'talk', say: '在角上的叫"角块"，它有 3 种颜色。一共有 8 个。', setup: '', highlight: ['UFR', 'UFL', 'UBR', 'UBL', 'DFR', 'DFL', 'DBR', 'DBL'] },
      { kind: 'talk', say: '在两个角中间的叫"棱块"，它有 2 种颜色。一共有 12 个。', setup: '', highlight: ['UF', 'UB', 'UR', 'UL', 'DF', 'DB', 'DR', 'DL', 'FR', 'FL', 'BR', 'BL'] },
      {
        kind: 'watch',
        say: '每面正中间的叫"中心块"。看好了，不管怎么转，中心块都不会跑！',
        setup: '',
        highlight: ['U', 'D', 'F', 'B', 'R', 'L'],
        steps: [
          { moves: 'R', say: '转右边，中心还在。' },
          { moves: 'U', say: '转上面，中心还在。' },
          { moves: 'F', say: '转前面，中心还在！中心块是这一面的"老家门牌"。' },
        ],
      },
      {
        kind: 'pick',
        say: '点一个角块！',
        setup: () => randomScramble(12),
        answer: (s) => s.cubies.filter((c) => c.id.length === 3).map((c) => c.id),
      },
      {
        kind: 'pick',
        say: '点一个棱块！',
        setup: () => randomScramble(12),
        answer: (s) => s.cubies.filter((c) => c.id.length === 2).map((c) => c.id),
      },
      {
        kind: 'quiz',
        say: `白${C('F')}${C('R')}这个角块，它的家在哪里？提示：看中心块的颜色。`,
        setup: '',
        highlight: ['DFR'],
        options: [
          { label: `白色、${C('F')}色、${C('R')}色三个面中间`, ok: true },
          { label: '哪里都可以', ok: false },
        ],
      },
    ],
  },
  {
    id: 'door',
    island: 'secret',
    emoji: '🚪',
    title: '开门、关门',
    goal: '明白 R U R\' 为什么不会弄乱底层',
    minutes: 6,
    parent:
      '这是整个 F2L 的核心原理：「开门(R) → 在顶层做事(U) → 关门(R\')」。开门时底层被借走一块，关门时原样还回来，所以只有顶层被改变。孩子理解了这一点，就不需要背 F2L 公式——每个公式都是"开门-做事-关门"。',
    secret: '开门的手，一定要关门！开门的时候，底层借走一块；关门的时候，原样还回来。所以底层不会乱，变的只有顶层。以后每一个好朋友回家的公式，都是开门、做事、关门。',
    scenes: [
      { kind: 'talk', say: '看底下的白色，全都是好的。我们来做一个魔法：开门、关门。', setup: '', highlight: ['DFR', 'DF', 'DR', 'FR', 'D'] },
      {
        kind: 'watch',
        say: '盯住亮着的方块！',
        setup: '',
        highlight: ['DFR', 'DF', 'DR', 'FR', 'D'],
        steps: [
          { moves: 'R', say: '开门：右手往上推。底下的白色跑上去了！' },
          { moves: 'U', say: '在顶层做事：顶层往左拨。' },
          { moves: "R'", say: '关门：右手拉下来。咦？底层又好了，只有顶层变了！' },
        ],
      },
      { kind: 'talk', say: '记住这个魔法：开门的手，一定要关门。这样底层就不会乱。', setup: "R U R'" },
      {
        kind: 'drill',
        say: '用你的魔方：跟着屏幕摆好，再自己变回去。开门、往回拨、关门。',
        cases: fixedDrill("R U' R'"),
        reps: 2,
      },
      {
        kind: 'drill',
        say: '这次是前面的门！前面逆时针是开门。',
        cases: fixedDrill("F' U F"),
        reps: 2,
      },
      { kind: 'real', say: '用你的魔方做：开门 R、顶层随便拨、关门 R\'，看看底层是不是还是好的？', checklist: ['做 3 次，每次底层都没坏', '对爸爸妈妈说出：为什么底层没坏'] },
    ],
  },
  {
    id: 'friends',
    island: 'secret',
    emoji: '🤝',
    title: '找好朋友',
    goal: '一眼找到角块的好朋友棱块',
    minutes: 5,
    parent:
      'F2L 的第一步是"配对"：底层角块(含白色)和它上面的棱块是一对。规则很简单：角块去掉白色剩下的两种颜色，就是好朋友棱块的颜色。这个"找朋友"练熟了，后面的观察/预判才有基础。',
    secret: '角块去掉白色，剩下两个颜色，就是它好朋友的颜色。好朋友的家，就在这两个颜色的中心块中间。',
    scenes: [
      { kind: 'talk', say: `白${C('F')}${C('R')}角块和${C('F')}${C('R')}棱块是一对好朋友。它们要一起回家，回到${C('F')}色和${C('R')}色中间。`, setup: '', highlight: SLOT_PIECES },
      { kind: 'talk', say: '秘诀：角块去掉白色，剩下两个颜色，就是好朋友的颜色！', setup: caseSetup(caseById('b1')), highlight: SLOT_PIECES },
      {
        kind: 'pick',
        say: '亮着的是角块，点出它的好朋友棱块！',
        rounds: 3,
        setup: () => randomScramble(14),
        highlight: ['DFR'],
        answer: () => ['FR'],
      },
      {
        kind: 'pick',
        say: '再来！这个角块的好朋友在哪？',
        rounds: 3,
        setup: () => randomScramble(14),
        highlight: ['DBL'],
        answer: () => ['BL'],
      },
    ],
  },
  {
    id: 'detour',
    island: 'secret',
    emoji: '↪️',
    title: '让路、做事、还原',
    goal: '学会高手的秘密：先让路',
    minutes: 6,
    parent:
      '高手的第二个核心思想叫"共轭"：A 做事 A\'。先用一步把东西挪到方便的位置(让路)，做完再挪回来。F2L 里的 U R U\' R\'、顶层的很多公式都是这个结构。当孩子卡住时，引导他问自己："是不是有东西挡住门了？先挪开！"',
    secret: '有东西挡住门，就先让路：挪开，做事，再挪回来。卡住的时候问问自己：是不是有东西挡住了？先挪开！',
    scenes: [
      { kind: 'talk', say: '好朋友已经手拉手了，可是它们就站在门口，挡住了门！', setup: caseSetup(caseById('b3'), false), highlight: SLOT_PIECES },
      { kind: 'watch', say: '高手的办法：先让路。', setup: caseSetup(caseById('b3'), false), highlight: SLOT_PIECES, steps: caseById('b3').steps },
      { kind: 'talk', say: '记住三个词：让路、做事、还原。不只是魔方，很多难题都可以这样想！', setup: '' },
      {
        kind: 'drill',
        say: '用你的魔方试试：先让路，再开门，回到门口，关门。',
        cases: f2lDrill(caseById('b3')),
        highlight: SLOT_PIECES,
        reps: 2,
      },
    ],
  },

  // ———————————— 岛 2：好朋友回家（F2L） ————————————
  basicLesson('key1', 'b1', '万能钥匙 1：右手碰头', '右手碰头：开门，把好朋友拨到门口，关门。还是开门、做事、关门，好朋友一起回家。'),
  basicLesson('key2', 'b2', '万能钥匙 2：左手碰头', '左手碰头是右手碰头的双胞胎：只是换成前面那扇门。前面开门，拨到门口，关门。'),
  basicLesson('key3', 'b3', '万能钥匙 3：右边让路', '好朋友站在门口挡住了门，就先让路：挪开，开门，好朋友走回门口，关门。'),
  basicLesson('key4', 'b4', '万能钥匙 4：前面让路', '前面的门也一样：先让路挪开，前面开门，好朋友走回门口，关门。'),
  {
    id: 'tricky',
    island: 'f2l',
    emoji: '🧩',
    title: '难的情况变简单',
    goal: '任何情况都先变成万能钥匙',
    minutes: 8,
    parent:
      '这是不背公式的关键：41 种 F2L 情况不用记，只要会 4 把"万能钥匙"，其余情况都是"先把两块请到顶层/分开假朋友 → 变成钥匙"。等孩子熟练以后，再慢慢学更短的走法。每次遇到难情况，问他：哪一块不在顶层？先把它请出来。',
    secret: '再难的情况都不用背。先把两块都请到顶层，而且不要牵错手，它就会变成一把万能钥匙。卡住了就问：哪一块不在顶层？先把它请出来。',
    scenes: [
      { kind: 'talk', say: '只要会 4 把万能钥匙，再难的情况都能变简单！秘诀：先让两块都到顶层，而且不要牵错手。', setup: '' },
      ...F2L_CASES.filter((c) => !c.basic).flatMap((c): Scene[] => [
        { kind: 'watch', say: `${c.emoji} ${c.name}：${c.look}`, setup: caseSetup(c, false), highlight: SLOT_PIECES, steps: c.steps },
        {
          kind: 'drill',
          say: `用你的魔方试试「${c.name}」！`,
          cases: f2lDrill(c),
          highlight: SLOT_PIECES,
          reps: 2,
        },
      ]),
    ],
  },
  {
    id: 'choose',
    island: 'f2l',
    emoji: '🎯',
    title: '先做哪一对？',
    goal: '学会挑最简单的那一对',
    minutes: 5,
    parent:
      '十字完成后有 4 对要做，顺序是自由的！高手总是先做"最简单的一对"：两块都在顶层的 > 有一块卡住的。另外：槽位在后面时，不一定要整个转魔方(y)，可以用左手(L)或者先转顶层把它挪到前面。这一课主要在真魔方上练。',
    secret: '四对好朋友，谁先回家都可以！先帮最简单的：两块都在顶层的先做，被卡住的后做。',
    scenes: [
      { kind: 'talk', say: '十字做好以后，有 4 对好朋友要回家。先帮谁？先帮最容易的！', setup: '' },
      {
        kind: 'quiz',
        say: '哪一对最容易？',
        options: [
          { label: '两块都在顶层的', ok: true },
          { label: '有一块卡在中间层的', ok: false },
          { label: '离我最近的', ok: false },
        ],
      },
      {
        kind: 'real',
        say: '用你的魔方：做好十字后，先找出 4 对好朋友都在哪，说给爸爸妈妈听，再从最容易的开始。',
        checklist: ['说出 4 对分别在哪', '先做了最容易的那对', '尽量不整个转魔方'],
      },
    ],
  },

  // ———————————— 岛 3：侦探眼睛 ————————————
  {
    id: 'look',
    island: 'eyes',
    emoji: '🔍',
    title: '高手的眼睛',
    goal: '知道"边做边看"',
    minutes: 5,
    parent:
      '速度的秘密不是手快，而是"手不停"。普通人：做完一对→停下来找→再做。高手：手在做这一对的时候，眼睛已经在找下一对。训练方法是故意"慢慢转但不停"（见节拍器游戏），以及 15 秒观察。练习时要接受"变慢"——慢而不停比快而停顿更快。',
    secret: '高手不是手更快，是眼睛更早。手在做这一对的时候，眼睛已经去找下一对了。慢慢转但是不停，比快快转又停下来找，还要快！',
    scenes: [
      { kind: 'talk', say: '高手和普通人有什么不一样？不是手更快，是眼睛更早！', setup: () => randomScramble(16) },
      {
        kind: 'talk',
        say: '规则 1：开始前有 15 秒观察。先找底十字的 4 个白棱块，想好怎么做。',
        setup: () => randomScramble(16),
        highlight: ['DF', 'DB', 'DR', 'DL'],
      },
      { kind: 'talk', say: '规则 2：做十字的时候，偷偷找第一对好朋友。', setup: () => randomScramble(16), highlight: ['DFR', 'FR'] },
      { kind: 'talk', say: '规则 3：手在做这一对，眼睛找下一对。慢慢转，但是不要停！', setup: () => randomScramble(16) },
      {
        kind: 'quiz',
        say: '哪种更快？',
        options: [
          { label: '慢慢转，一直不停', ok: true },
          { label: '很快地转，然后停下来找', ok: false },
        ],
      },
      { kind: 'real', say: '去玩「跟踪小侦探」和「乌龟节拍器」吧！', checklist: [] },
    ],
  },
  {
    id: 'inspect',
    island: 'eyes',
    emoji: '⏱️',
    title: '15 秒观察挑战',
    goal: '观察时就把十字想好',
    minutes: 6,
    parent:
      '比赛有 15 秒观察时间。让孩子拿到打乱的魔方先"只看不动"，说出：①4 个白棱块在哪 ②先做哪个 ③(进阶)第一对好朋友在哪。然后闭眼也能做出十字是终极目标。家长可以用计时器页面的"观察倒计时"。',
    secret: '开始之前先看，只看不动手。看清 4 个白色棱块在哪里、先做哪一个，想好了再动手。',
    scenes: [
      { kind: 'talk', say: '观察时只看不动手！找到 4 个白色棱块。', setup: () => randomScramble(16), highlight: ['DF', 'DB', 'DR', 'DL'] },
      {
        kind: 'pick',
        say: '点出一个白色棱块！',
        rounds: 2,
        setup: () => randomScramble(16),
        answer: () => ['DF', 'DB', 'DR', 'DL'],
      },
      {
        kind: 'real',
        say: '真魔方挑战：打乱后先观察 15 秒，说出十字的计划，然后再动手。',
        checklist: ['说出 4 个白棱块在哪', '说出先做哪一个', '做十字时不停下来', '进阶：说出第一对好朋友在哪'],
      },
    ],
  },

  // ———————————— 岛 4：顶层城堡 ————————————
  {
    id: 'map7',
    island: 'top',
    emoji: '🗺️',
    title: '七步法变四步',
    goal: '知道顶层只要 4 步',
    minutes: 5,
    parent:
      '七步法的顶层其实已经接近 CFOP 的"两步 OLL + 两步 PLL"：顶层十字(=OLL 第一步)、顶面(=OLL 第二步，小鱼家族)、顶角归位(=PLL 第一步)、顶棱归位(=PLL 第二步)。升级的重点不是马上背 57+21 个公式，而是：①每一步用"认出来就对的公式"代替"重复做直到好"；②学会用"车灯"认 PLL；③做完 OLL 时就预判 PLL。',
    secret: '顶层只要 4 步：黄十字、黄色顶面、角换位、棱换位。每一步先认出是哪一种，再做对的公式，做一次就好，不用一遍一遍碰运气。',
    scenes: [
      { kind: 'talk', say: '顶层城堡有 4 道门：黄十字、黄色顶面、角换位、棱换位。', setup: llScramble(OLL_CORNERS[0].alg), view: 'top' },
      { kind: 'talk', say: '第 1、2 道门叫 OLL：把顶面变成全黄。你已经会很多了！', setup: llScramble(OLL_EDGES[0].alg), view: 'top' },
      { kind: 'talk', say: '第 3、4 道门叫 PLL：把侧面的颜色排好。秘诀是看"车灯"。', setup: llScramble(PLL_CORNERS[0].alg), view: 'top' },
      {
        kind: 'quiz',
        say: '高手做顶层，最重要的是什么？',
        options: [
          { label: '先认出是哪种情况，再做对的公式', ok: true },
          { label: '一直重复同一个公式，直到好', ok: false },
        ],
      },
    ],
  },
  {
    id: 'ollcross',
    island: 'top',
    emoji: '➕',
    title: '黄十字三兄弟',
    goal: '一眼认出点、拐弯、一字',
    minutes: 6,
    parent: '黄十字只有 3 种情况：一个点、小拐弯、一字。关键是"摆放方向"：一字横着放、拐弯放左后方。让孩子先说"这是哪种、要怎么摆"，再动手。',
    secret: '黄十字只有 3 种：一个点、小拐弯、一字。先认出是哪一种，再摆好方向：一字横着放，拐弯放在左后面。摆对了，做一次就好。',
    scenes: [
      ...OLL_EDGES.map(
        (c): Scene => ({
          kind: 'watch',
          say: `${c.emoji} ${c.name}：${c.look}。${c.tip ?? ''}`,
          setup: invertAlg(c.alg),
          view: 'top',
          steps: [{ moves: c.alg, say: '看公式怎么变出黄十字。' }],
        }),
      ),
      {
        kind: 'quiz',
        say: '顶面是哪一种？',
        view: 'top',
        rounds: 4,
        options: () => {
          const c = pick(OLL_EDGES);
          return { setup: llScramble(c.alg), options: OLL_EDGES.map((o) => ({ label: `${o.emoji} ${o.name}`, ok: o.id === c.id })) };
        },
      },
    ],
  },
  {
    id: 'fish',
    island: 'top',
    emoji: '🐟',
    title: '小鱼家族',
    goal: '黄十字之后，认出 7 种顶面',
    minutes: 8,
    parent:
      '黄十字之后只剩 7 种情况（OCLL）。孩子已经会不少 OLL，这里重点是"看侧面认情况"：看黄色贴纸在侧面的位置(车灯、鱼头)。家长可以在"家长中心"勾选孩子已经会的公式。',
    secret: '黄十字做好以后，顶面只剩 7 种样子。不要只看顶上，还要看侧面的黄色在哪里，认出来就知道做哪个公式。',
    scenes: [
      ...OLL_CORNERS.map(
        (c): Scene => ({
          kind: 'watch',
          say: `${c.emoji} ${c.name}：${c.look}。`,
          setup: invertAlg(c.alg),
          view: 'top',
          steps: [{ moves: c.alg, say: c.alg }],
        }),
      ),
      {
        kind: 'quiz',
        say: '这是哪一种？',
        view: 'top',
        rounds: 5,
        options: () => {
          const c = pick(OLL_CORNERS);
          const others = OLL_CORNERS.filter((o) => o.id !== c.id).sort(() => Math.random() - 0.5).slice(0, 2);
          return {
            setup: llScramble(c.alg),
            options: [c, ...others].sort(() => Math.random() - 0.5).map((o) => ({ label: `${o.emoji} ${o.name}`, ok: o.id === c.id })),
          };
        },
      },
    ],
  },
  {
    id: 'lights',
    island: 'top',
    emoji: '🚗',
    title: '认车灯',
    goal: '用车灯认出角怎么换',
    minutes: 6,
    parent:
      '"车灯"= 同一侧面的两个角颜色相同。顶面全黄后，转一圈看 4 个侧面：①四面都有车灯 → 角已经好了，直接做棱；②只有一面有车灯 → 车灯放左边，做 T 换位；③没有车灯 → Y 换位。这是从七步法"做公式碰运气"升级到"看一眼就知道"的关键。',
    secret: '同一面的两个角颜色一样，就是车灯。转一圈找车灯：四面都有车灯，角已经好了；只有一面有，车灯放左边，做 T；一个都没有，做 Y。',
    scenes: [
      {
        kind: 'talk',
        say: '看前面最上面一排！两个角的颜色一样，就像汽车的两个车灯。',
        setup: `${invertAlg(PLL_CORNERS[0].alg)} U'`,
        view: 'front',
        highlight: ['UFL', 'UBL'],
      },
      ...PLL_CORNERS.map(
        (c): Scene => ({
          kind: 'watch',
          say: `${c.emoji} ${c.name}：${c.look}。${c.tip ?? ''}`,
          setup: invertAlg(c.alg),
          steps: [{ moves: c.alg, say: '看角块怎么交换。' }],
        }),
      ),
      {
        kind: 'quiz',
        say: '转着看一看（可以用手指拖动魔方），有车灯吗？',
        rounds: 4,
        options: () => {
          const r = Math.random();
          const c = r < 0.2 ? null : r < 0.6 ? PLL_CORNERS[0] : PLL_CORNERS[1];
          const setup = c ? llScramble(c.alg) : llScramble(pick(PLL_EDGES).alg);
          return {
            setup,
            options: [
              { label: '一面有车灯', ok: c?.id === 'T' },
              { label: '没有车灯', ok: c?.id === 'Y' },
              { label: '四面都有车灯', ok: !c },
            ],
          };
        },
      },
    ],
  },
  {
    id: 'edges',
    island: 'top',
    emoji: '🔄',
    title: '最后的棱块',
    goal: '认出 4 种棱块换位',
    minutes: 7,
    parent:
      '角都好了以后，只剩 4 种：有一面完成→Ua/Ub(七步法里的那个公式就是它)；四面都不对→看是对面交换(H)还是相邻交换(Z)。七步法里重复做 U 换位直到好，CFOP 里看一眼选对方向，一次完成。',
    secret: '角都好了以后看棱块：有一面已经全对了，就把它放后面，做三棱轮换；四面都不对，看是对面换还是旁边换。看一眼选对，一次就好。',
    scenes: [
      ...PLL_EDGES.map(
        (c): Scene => ({
          kind: 'watch',
          say: `${c.emoji} ${c.name}：${c.look}。${c.tip ?? ''}`,
          setup: invertAlg(c.alg),
          steps: [{ moves: c.alg, say: '看棱块怎么换。' }],
        }),
      ),
      {
        kind: 'quiz',
        say: '这是哪一种？（可以拖动魔方看后面）',
        rounds: 4,
        options: () => {
          const c = pick(PLL_EDGES);
          return { setup: invertAlg(c.alg), options: PLL_EDGES.map((o) => ({ label: `${o.emoji} ${o.name}`, ok: o.id === c.id })) };
        },
      },
    ],
  },
];

export function lessonsOf(island: string): Lesson[] {
  return LESSONS.filter((l) => l.island === island);
}

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function resolveSetup(s: string | (() => string) | undefined): string {
  if (!s) return '';
  return typeof s === 'function' ? s() : s;
}
