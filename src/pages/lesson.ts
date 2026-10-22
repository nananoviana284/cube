import { parseAlg } from '../cube/alg';
import type { CubeState } from '../cube/model';
import { LESSONS, lessonById, resolveSetup, type Goal, type Scene } from '../content/lessons';
import { giveStars, load } from '../store';
import { beep, celebrate, h, speak, starsText, stopSpeak } from '../ui/dom';
import { algView, bubble, movePad, playWithArrows, stage, topbar, wait } from '../ui/components';

export function checkGoal(s: CubeState, g: Goal): boolean {
  switch (g) {
    case 'solved':
      return s.isSolved();
    case 'cross':
      return s.isCrossSolved();
    case 'topCross':
      return s.isTopCrossDone();
    case 'oll':
      return s.isOLLSolved();
  }
}

function tryParse(alg: string): string[] | null {
  try {
    return parseAlg(alg).map((m) => m.text);
  } catch {
    return null;
  }
}

export function lessonPage(root: HTMLElement, id: string): () => void {
  const lesson = lessonById(id);
  if (!lesson) {
    location.hash = '#/';
    return () => {};
  }
  let idx = 0;
  let mistakes = 0;
  let alive = true;
  const st = stage('front');
  const { view } = st;
  const dots = h('div', { class: 'dots' }, ...lesson.scenes.map(() => h('span')));
  const side = h('div', { class: 'side' });
  root.append(
    topbar(`${lesson.emoji} ${lesson.title}`, `#/island/${lesson.island}`, dots),
    h('div', { class: 'player' }, st.el, side),
  );

  const setDots = () =>
    [...dots.children].forEach((d, i) => {
      d.classList.toggle('done', i < idx);
      d.classList.toggle('on', i === idx);
    });

  const next = () => {
    if (!alive) return;
    idx++;
    if (idx >= lesson.scenes.length) finish();
    else show();
  };

  const parentNote = () =>
    h('details', { class: 'parent-note' }, h('summary', null, '👨‍👩‍👦 家长看这里'), h('div', { html: lesson.parent }));

  function prep(scene: Exclude<Scene, { kind: 'real' }>): string {
    const setup = resolveSetup(scene.setup);
    view.setAlg(setup);
    view.highlight(scene.highlight ?? null);
    view.glow([]);
    view.showArrow(null);
    view.onPick(null);
    view.setPreset('view' in scene && scene.view ? scene.view : 'front');
    return setup;
  }

  function show(): void {
    setDots();
    side.replaceChildren();
    st.cover(false);
    const scene = lesson!.scenes[idx];
    side.append(bubble(scene.say));
    speak(scene.say);
    if (scene.kind !== 'real') prep(scene);

    if (scene.kind === 'talk') {
      side.append(h('div', { class: 'btn-row' }, h('button', { class: 'btn green', onclick: next }, '懂了 👉')));
    }

    if (scene.kind === 'watch') {
      let step = 0;
      const sayBox = h('div', { class: 'step-say' }, '按 ▶ 开始');
      const all = scene.steps.map((s) => s.moves).join(' ');
      const av = algView(all);
      const offsets: number[] = [];
      let acc = 0;
      for (const s of scene.steps) {
        offsets.push(acc);
        acc += parseAlg(s.moves).length;
      }
      const playBtn = h('button', { class: 'btn blue' }, '▶ 下一步');
      const againBtn = h('button', { class: 'btn ghost' }, '🔁 再看一次');
      const nextBtn = h('button', { class: 'btn green', disabled: 'true' }, '看懂了 👉');
      let busy = false;
      playBtn.onclick = async () => {
        if (busy || step >= scene.steps.length) return;
        busy = true;
        const s = scene.steps[step];
        sayBox.textContent = s.say;
        speak(s.say);
        await playWithArrows(view, s.moves, (i) => av.at(offsets[step] + i));
        step++;
        busy = false;
        if (step >= scene.steps.length) {
          playBtn.setAttribute('disabled', 'true');
          nextBtn.removeAttribute('disabled');
          beep('good');
        }
      };
      againBtn.onclick = () => {
        if (busy) return;
        step = 0;
        av.at(-1);
        prep(scene);
        playBtn.removeAttribute('disabled');
        sayBox.textContent = '按 ▶ 开始';
      };
      nextBtn.onclick = next;
      side.append(sayBox, av.el, h('div', { class: 'btn-row' }, playBtn, againBtn), h('div', { class: 'btn-row' }, nextBtn));
    }

    if (scene.kind === 'try') {
      const setup = prep(scene);
      const hintToks = tryParse(scene.hint);
      let hintOn = false;
      let hintPos = 0;
      let count = 0;
      let done = false;
      const status = h('div', { class: 'step-say' }, '加油！');
      const pad = movePad(scene.moves, async (m) => {
        if (done || view.busy) return;
        count++;
        if (hintOn && hintToks) {
          if (m === hintToks[hintPos]) hintPos++;
          else hintOn = false;
        }
        pad.mark(null);
        view.showArrow(null);
        await view.play(m);
        if (checkGoal(view.state, scene.goal)) {
          done = true;
          celebrate('成功啦！');
          status.textContent = `🎉 用了 ${count} 步！`;
          speak('成功啦！');
          await wait(1200);
          next();
          return;
        }
        if (hintOn && hintToks && hintPos < hintToks.length) {
          pad.mark(hintToks[hintPos]);
          view.showArrow(hintToks[hintPos]);
        }
        if (count > 14 && !hintOn) status.textContent = '有点难？试试 💡 提示，或者 🔁 重来。';
      });
      const reset = () => {
        view.setAlg(setup);
        count = 0;
        hintOn = false;
        pad.mark(null);
        view.showArrow(null);
        status.textContent = '重新开始！';
      };
      const hintBtn = h('button', { class: 'btn ghost' }, '💡 提示');
      hintBtn.onclick = () => {
        mistakes++;
        if (!hintToks) {
          status.textContent = `💡 ${scene.hint}`;
          speak(scene.hint);
          return;
        }
        reset();
        hintOn = true;
        hintPos = 0;
        pad.mark(hintToks[0]);
        view.showArrow(hintToks[0]);
        status.textContent = '跟着粉色箭头转！';
      };
      side.append(status, pad.el, h('div', { class: 'btn-row' }, hintBtn, h('button', { class: 'btn ghost', onclick: reset }, '🔁 重来')));
    }

    if (scene.kind === 'pick') {
      const rounds = scene.rounds ?? 1;
      let round = 0;
      const status = h('div', { class: 'step-say' }, rounds > 1 ? `第 1 / ${rounds} 题` : '点魔方上的方块');
      const setRound = () => {
        if (round > 0) prep(scene);
        view.onPick((pid) => {
          if (!alive) return;
          const ok = scene.answer(view.state).includes(pid);
          if (ok) {
            beep('good');
            view.highlight([...(scene.highlight ?? []), pid]);
            round++;
            if (round >= rounds) {
              view.onPick(null);
              celebrate('找到啦！');
              setTimeout(next, 1100);
            } else {
              status.textContent = `✅ 对！第 ${round + 1} / ${rounds} 题`;
              setTimeout(setRound, 700);
            }
          } else {
            mistakes++;
            beep('bad');
            status.textContent = '再找找～ 可以用手指拖动魔方看背面哦';
          }
        });
      };
      setRound();
      side.append(status);
    }

    if (scene.kind === 'quiz') {
      const rounds = scene.rounds ?? 1;
      let round = 0;
      const box = h('div', { class: 'options' });
      const status = h('div', { class: 'step-say' }, rounds > 1 ? `第 1 / ${rounds} 题` : '选一个');
      const ask = () => {
        let opts: { label: string; ok: boolean }[];
        if (typeof scene.options === 'function') {
          const g = scene.options();
          view.setAlg(g.setup);
          view.resetView();
          opts = g.options;
        } else opts = scene.options;
        box.replaceChildren(
          ...opts.map((o) => {
            const b = h('button', { class: 'option' }, o.label);
            b.onclick = () => {
              if (o.ok) {
                b.classList.add('ok');
                beep('good');
                round++;
                if (round >= rounds) {
                  celebrate('答对啦！');
                  setTimeout(next, 1100);
                } else {
                  status.textContent = `✅ 对！第 ${round + 1} / ${rounds} 题`;
                  setTimeout(ask, 700);
                }
              } else {
                mistakes++;
                beep('bad');
                b.classList.add('no');
                setTimeout(() => b.classList.remove('no'), 400);
              }
            };
            return b;
          }),
        );
      };
      ask();
      side.append(status, box);
    }

    if (scene.kind === 'real') {
      view.setAlg(scene.parentSetup ?? '');
      view.highlight(null);
      view.showArrow(null);
      st.cover(true, '🧊✋');
      const items = scene.checklist ?? [];
      const checks = h(
        'div',
        { class: 'checks' },
        ...items.map((t) => {
          const b = h('button', { class: 'check' }, h('span', { class: 'box' }), t);
          b.onclick = () => {
            b.classList.toggle('on');
            b.querySelector('.box')!.textContent = b.classList.contains('on') ? '✓' : '';
            beep('tick');
          };
          return b;
        }),
      );
      if (scene.parentSetup) {
        side.append(
          h(
            'div',
            { class: 'parent-note' },
            h('b', null, '家长摆法：'),
            '拿一个复原的魔方（白色朝下、绿色朝前），做 ',
            h('span', { class: 'alg' }, scene.parentSetup),
            '，就摆出了这个情况。',
            h('button', { class: 'btn ghost', style: 'margin-top:8px;font-size:16px;padding:8px 14px', onclick: () => {
              st.cover(false);
              view.setAlg('');
              playWithArrows(view, scene.parentSetup!);
            } }, '👀 看摆法动画'),
          ),
        );
      }
      side.append(checks, h('div', { class: 'btn-row' }, h('button', { class: 'btn green', onclick: next }, '我做到了！💪')));
    }

    side.append(parentNote());
  }

  function finish(): void {
    view.onPick(null);
    view.showArrow(null);
    view.highlight(null);
    const stars = mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1;
    giveStars(lesson!.id, stars);
    setDots();
    celebrate(`${starsText(stars)}`);
    speak(`闯关成功！你得到了 ${stars} 颗星星`);
    const i = LESSONS.findIndex((l) => l.id === lesson!.id);
    const nextLesson = LESSONS[i + 1];
    side.replaceChildren(
      h(
        'div',
        { class: 'finish' },
        h('div', { class: 'stars' }, starsText(stars)),
        h('h2', null, '闯关成功！'),
        h('p', { class: 'muted' }, `${load().kidName}，今天学会了：${lesson!.goal}`),
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn ghost', onclick: () => (location.hash = `#/island/${lesson!.island}`) }, '回到地图'),
          nextLesson ? h('button', { class: 'btn green', onclick: () => (location.hash = `#/lesson/${nextLesson.id}`) }, `下一关 ${nextLesson.emoji}`) : null,
        ),
      ),
    );
    view.setAlg('');
    view.play("y y y y", 500);
  }

  show();
  return () => {
    alive = false;
    stopSpeak();
    view.dispose();
  };
}

