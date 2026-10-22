// 所有用到的公式。每一条都在 tests/algs.test.ts 里用模型验证过它真的做了它声称的事。

export interface Step {
  moves: string;
  say: string;
}

export interface F2LCase {
  id: string;
  name: string;
  emoji: string;
  /** 一句话认出这个情况 */
  look: string;
  /** 解法拆成几段，每段配一句"为什么" */
  steps: Step[];
  /** 是否基础情况（4 个"万能钥匙"） */
  basic: boolean;
}

export function joinSteps(steps: Step[]): string {
  return steps.map((s) => s.moves).join(' ');
}

// ——— F2L：右前槽（FR）——————————————————————————————
// 基础 4 招：所有复杂情况都先变成这 4 种之一
export const F2L_CASES: F2LCase[] = [
  {
    id: 'b1',
    name: '右手碰头',
    emoji: '🤝',
    basic: true,
    look: '角块在右前上方、白色朝右；棱块在正后方（顶层）。',
    steps: [
      { moves: 'R', say: '开门：右手往上推。角块被带到后面，正好和棱块牵上手！' },
      { moves: 'U', say: '顶层往左拨，这对好朋友走到右边门口。' },
      { moves: "R'", say: '关门：右手拉下来，好朋友一起回家。' },
    ],
  },
  {
    id: 'b2',
    name: '左手碰头',
    emoji: '🫱',
    basic: true,
    look: '角块在右前上方、白色朝前；棱块在左边（顶层）。',
    steps: [
      { moves: "F'", say: '开门：前面逆时针。角块被带到左边，和棱块牵上手！' },
      { moves: "U'", say: '顶层往右拨，这对好朋友走到前面门口。' },
      { moves: 'F', say: '关门：前面顺时针，好朋友一起回家。' },
    ],
  },
  {
    id: 'b3',
    name: '右边让路',
    emoji: '🚪',
    basic: true,
    look: '角块和棱块已经手拉手站在右边顶上，角块白色朝前。',
    steps: [
      { moves: 'U', say: '让路：先把好朋友挪开，别挡着门。' },
      { moves: 'R', say: '开门：右手往上推，门打开了。' },
      { moves: "U'", say: '好朋友走回门口。' },
      { moves: "R'", say: '关门：一起回家！' },
    ],
  },
  {
    id: 'b4',
    name: '前面让路',
    emoji: '🚪',
    basic: true,
    look: '角块和棱块已经手拉手站在前面顶上，角块白色朝右。',
    steps: [
      { moves: "U'", say: '让路：先把好朋友挪开，别挡着门。' },
      { moves: "F'", say: '开门：前面逆时针，门打开了。' },
      { moves: 'U', say: '好朋友走回门口。' },
      { moves: 'F', say: '关门：一起回家！' },
    ],
  },
  // ——— 进阶：先变成基础情况 ———
  {
    id: 'a1',
    name: '角块卡在家里',
    emoji: '🪤',
    basic: false,
    look: '角块卡在槽里（白色朝右边，方向不对），棱块在顶层。',
    steps: [
      { moves: "R U R'", say: '先把角块"请出来"：开门、挪一下、关门。现在两块都在顶层了。' },
      { moves: "U' R U R'", say: '变成了"右手碰头"！用万能钥匙就能回家。' },
    ],
  },
  {
    id: 'a2',
    name: '棱块卡在中间',
    emoji: '🧱',
    basic: false,
    look: '棱块在槽里但方向反了，角块在顶层。',
    steps: [
      { moves: "R U' R'", say: '先把棱块"请出来"：开门、挪一下、关门。' },
      { moves: "U' F' U' F", say: '变成了"左手碰头"！用万能钥匙回家。' },
    ],
  },
  {
    id: 'a3',
    name: '白色朝天',
    emoji: '☀️',
    basic: false,
    look: '角块在右前上方，白色朝上（最难看出来的一种）。',
    steps: [
      { moves: "R U2 R'", say: '白色朝天时，先用"开门-转两下-关门"把白色转到侧面。' },
      { moves: "U' R U R'", say: '变成了"右手碰头"，万能钥匙回家！' },
    ],
  },
  {
    id: 'a4',
    name: '牵错了手',
    emoji: '🙅',
    basic: false,
    look: '角块和棱块挨在一起，但颜色没对上（假朋友）。',
    steps: [
      { moves: "R U' R'", say: '假朋友要先分开：开门、拨开、关门。' },
      { moves: "U R U R'", say: '变成了"右手碰头"，万能钥匙回家！' },
    ],
  },
];

// ——— OLL：两步法（先十字，再"小鱼家族"）———————————————
export interface LLCase {
  id: string;
  name: string;
  emoji: string;
  look: string;
  alg: string;
  tip?: string;
  /** 和别的公式是什么关系（倒着做、做两遍、外面套一扇门……） */
  kin?: string;
  /** 拼起来的公式：一段一段做，每做一段魔方变成什么样 */
  chain?: Step[];
  /** 亲戚：关系 + 对方在公式本里的 key */
  rel?: { label: string; to: string }[];
}

export const OLL_EDGES: LLCase[] = [
  { id: 'line', name: '一字', emoji: '➖', look: '顶面中间一条横线', alg: "F R U R' U' F'", tip: '横线要横着放（左右方向）。', kin: "前面开门 F + 小手法 R U R' U' + 关门 F'。", rel: [{ label: '把中间换成 U R U\' R\'', to: 'oe-L' }] },
  { id: 'L', name: '小拐弯', emoji: '↩️', look: '顶面一个小 L', alg: "F U R U' R' F'", tip: 'L 的两条腿放在后面和左边（像左上角的拐弯）。', kin: "一字的亲戚：门还是 F，中间换成 U R U' R'。", rel: [{ label: "把中间换成 R U R' U'", to: 'oe-line' }] },
  { id: 'dot', name: '一个点', emoji: '⚫', look: '顶面只有中心是黄的', alg: "F R U R' U' F' U2 F U R U' R' F'", tip: '= 一字 + 转两下 + 小拐弯，连起来做。', kin: '拼起来的：一字 + U2 + 小拐弯。',
    chain: [
      { moves: "F R U R' U' F'", say: '先做一字的公式：一个点变成了小拐弯。' },
      { moves: 'U2', say: '转两下，把小拐弯摆到左后面。' },
      { moves: "F U R U' R' F'", say: '做小拐弯的公式：黄十字出来了！' },
    ] },
];

export const OLL_CORNERS: LLCase[] = [
  { id: 'sune', name: '小鱼（右）', emoji: '🐟', look: '一个角是黄的，鱼头朝左下', alg: "R U R' U R U2 R'", kin: '倒着做 = 小鱼（左）；做两遍 = 双车灯。', rel: [{ label: '倒着做', to: 'oc-antisune' }, { label: '做两遍', to: 'oc-H' }] },
  { id: 'antisune', name: '小鱼（左）', emoji: '🐠', look: '一个角是黄的，鱼头朝右下', alg: "R U2 R' U' R U' R'", kin: '小鱼（右）倒着做就是它。', rel: [{ label: '倒着做', to: 'oc-sune' }] },
  { id: 'H', name: '双车灯', emoji: '🚗', look: '没有黄角，左右两边各有一对黄色', alg: "R U R' U R U' R' U R U2 R'", kin: '小鱼（右）连做两遍，效果一样。',
    chain: [
      { moves: "R U R' U R U2 R'", say: '先做一次小鱼：双车灯变成了一条小鱼。' },
      { moves: "R U R' U R U2 R'", say: '再做一次小鱼：顶面全黄了！' },
    ] },
  { id: 'pi', name: '大车灯', emoji: '🚙', look: '没有黄角，只有一边有一对黄色', alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { id: 'U', name: '车头灯', emoji: '🔦', look: '两个黄角相邻，对面有一对黄色', alg: "R2 D R' U2 R D' R' U2 R'", kin: '下面借一块（D）、顶上转两下、还回去（D 撇）：还是开门关门。' },
  { id: 'T', name: '小T', emoji: '🔨', look: '两个黄角相邻，侧面各有一个黄', alg: "r U R' U' r' F R F'", kin: "中间藏着小手法 U R' U'，用小 r 开门关门。" },
  { id: 'L', name: '蝴蝶结', emoji: '🎀', look: '两个黄角在对角', alg: "F' r U R' U' r' F R", kin: "= 前面开门 F' + 小T + 关门 F。", rel: [{ label: "外面套一扇门 F'", to: 'oc-T' }] },
];

// ——— PLL：两步法（先角，再棱）———————————————————
export const PLL_CORNERS: LLCase[] = [
  {
    id: 'T',
    name: 'T 换位（车灯）',
    emoji: '🚦',
    look: '有一边有"车灯"（两个角颜色相同）',
    alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
    tip: '把车灯放在左边再做。',
    kin: "开头就是小手法 R U R' U'。",
  },
  {
    id: 'Y',
    name: 'Y 换位（没车灯）',
    emoji: '🔀',
    look: '四边都没有车灯',
    alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    tip: '对角两个角交换，哪边对着你都可以。',
    kin: "前半段像一字（F 开门关门），后半段是小手法 + R' F R F'。",
  },
];

export const PLL_EDGES: LLCase[] = [
  { id: 'Ua', name: '三棱轮换（顺）', emoji: '🔄', look: '有一面全对了，另外三条棱顺着转', alg: "R U' R U R U R U' R' U' R2", tip: '完成的那面放后面。', kin: '倒着做 = 三棱轮换（逆）。', rel: [{ label: '倒着做', to: 'p-Ub' }] },
  { id: 'Ub', name: '三棱轮换（逆）', emoji: '🔃', look: '有一面全对了，另外三条棱逆着转', alg: "R2 U R U R' U' R' U' R' U R'", tip: '完成的那面放后面。', kin: '倒着做 = 三棱轮换（顺）。', rel: [{ label: '倒着做', to: 'p-Ua' }] },
  { id: 'H', name: '十字交换', emoji: '➕', look: '对面两两交换，四面都不对', alg: "M2 U M2 U2 M2 U M2" },
  { id: 'Z', name: '相邻交换', emoji: '⚡', look: '相邻两两交换，四面都不对', alg: "M2 U M2 U M' U2 M2 U2 M' U2" },
];
