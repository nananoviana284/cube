import { invertAlg, parseAlg, randomScramble } from '../cube/alg';
import { h } from '../ui/dom';
import { algView, movePad, playWithArrows, stage, topbar } from '../ui/components';
import { setKeys } from '../ui/keys';

/** 自由魔方：家长输入任何公式看动画、摆情况 */
export function labPage(root: HTMLElement): () => void {
  const st = stage('front');
  const { view } = st;
  const input = h('input', { class: 'lab-input', placeholder: "输入公式，例如 R U R' U'", value: "R U R' U' R' F R2 U' R' U' R U R' F'" }) as HTMLInputElement;
  const msg = h('div', { class: 'muted' });
  const avBox = h('div');
  const run = async (fromCase: boolean) => {
    const alg = input.value.trim();
    try {
      parseAlg(alg);
    } catch (e) {
      msg.textContent = String((e as Error).message);
      return;
    }
    msg.textContent = '';
    if (fromCase) view.setAlg(invertAlg(alg));
    const av = algView(alg);
    avBox.replaceChildren(av.el);
    await playWithArrows(view, alg, av.at);
  };
  const pad = movePad(['R', "R'", 'L', "L'", 'U', "U'", 'D', "D'", 'F', "F'", 'B', "B'", 'M', "M'", 'y', "y'"], (m) => view.play(m));
  setKeys({ esc: () => (location.hash = '#/parent') });
  root.append(
    topbar('自由魔方', '#/parent'),
    h(
      'div',
      { class: 'player' },
      st.el,
      h(
        'div',
        { class: 'side' },
        input,
        msg,
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn blue', onclick: () => run(true) }, '看它解决什么'),
          h('button', { class: 'btn ghost', onclick: () => run(false) }, '从当前做'),
        ),
        avBox,
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn ghost', onclick: () => view.setAlg('') }, '复原'),
          h('button', { class: 'btn ghost', onclick: () => view.setAlg(randomScramble(20)) }, '打乱'),
        ),
        pad.el,
        h('div', {
          class: 'info-note',
          html: '<b>小技巧：</b>"看它解决什么"会先把魔方摆成这个公式能解决的情况，再播放公式——用来给孩子演示任何一个 OLL/PLL/F2L 公式。支持 R U F L D B、M E S、x y z、小写宽层 r f 等写法。',
        }),
      ),
    ),
  );
  return () => view.dispose();
}
