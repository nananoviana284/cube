import { kidWords, parseAlg } from '../cube/alg';
import { faceName } from '../cube/model';
import type { CubeState } from '../cube/model';
import { LESSONS, lessonById, resolveSetup, type Goal, type Scene } from '../content/lessons';
import { giveStars, load, save } from '../store';
import { beep, celebrate, h, speak, starsText, stopSpeak } from '../ui/dom';
import { clearKeys, setKeys, type KeyMap } from '../ui/keys';
import { withNicks } from './book';
import { algView, keyBtn, keyHints, movePad, playWithArrows, stage, topbar, wait } from '../ui/components';

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

/** 跟着做时最多带孩子转多少步（太长的打乱不适合跟着做） */
const FOLLOW_MAX = 14;

export function lessonPage(root: HTMLElement, id: string): () => void {
  const lesson = lessonById(id);
  if (!lesson) {
    location.hash = '#/';
    return () => {};
  }
  save((d) => (d.lastLesson = lesson.id));
  let idx = 0;
  let mistakes = 0;
  let alive = true;
  /** 每换一个场景加 1，旧场景里还在跑的动画/朗读看到不一致就停下 */
  let gen = 0;
  const st = stage('front');
  const { view } = st;
  const dots = h('div', { class: 'dots' }, ...lesson.scenes.map(() => h('span')));
  const side = h('div', { class: 'side' });
  const islandHref = `#/island/${lesson.island}`;
  const toIsland = () => (location.hash = islandHref);
  root.append(topbar(`${lesson.emoji} ${lesson.title}`, islandHref, dots), h('div', { class: 'player' }, st.el, side));

  const setDots = () =>
    [...dots.children].forEach((d, i) => {
      d.classList.toggle('done', i < idx);
      d.classList.toggle('on', i === idx);
    });

  const goto = (i: number) => {
    if (!alive) return;
    idx = Math.max(0, i);
    if (idx >= lesson.scenes.length) finish();
    else show();
  };
  const next = () => goto(idx + 1);

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

  /** 注册当前场景的键（每个场景都有：V 再听、← 上一步、Esc 回地图），返回键位提示 */
  function keys(say: string, extra: KeyMap, hints: [string, string][]): HTMLElement {
    setKeys({
      voice: () => speak(say, true),
      left: idx > 0 ? () => goto(idx - 1) : undefined,
      esc: toIsland,
      ...extra,
    });
    const common: [string, string][] = [['V', '再听一遍']];
    if (idx > 0) common.push(['←', '上一步']);
    common.push(['Esc', '回地图']);
    return keyHints([...hints, ...common]);
  }

  /**
   * 跟着做：每一步亮箭头、读口令、停一会儿再转，孩子用自己的魔方同步做。
   * 空格可以不等停顿直接下一步。返回 false 表示中途被打断。
   */
  async function follow(alg: string, start: string, box: HTMLElement, my: number): Promise<boolean> {
    const moves = parseAlg(alg).map((m) => m.text);
    view.setAlg(start);
    view.setPreset('front');
    st.cover(false);
    let skip: (() => void) | null = null;
    setKeys({ space: () => skip?.(), right: () => skip?.(), esc: toIsland });
    for (let i = 0; i < moves.length; i++) {
      if (!alive || my !== gen) return false;
      const m = moves[i];
      box.replaceChildren(h('div', { class: 'follow-move' }, m, h('small', null, `${kidWords(m)}（${i + 1}/${moves.length}）`)));
      view.showArrow(m);
      view.onMove?.(m);
      await speak(`${m}，${kidWords(m)}`);
      await new Promise<void>((r) => {
        const t = setTimeout(r, load().followPause);
        skip = () => {
          clearTimeout(t);
          r();
        };
      });
      skip = null;
      if (!alive || my !== gen) return false;
      view.showArrow(null);
      await view.play(m);
    }
    return true;
  }

  function show(): void {
    const my = ++gen;
    stopSpeak();
    setDots();
    side.replaceChildren();
    st.cover(false);
    const scene = lesson!.scenes[idx];
    const say = withNicks(scene.say);
    side.append(h('div', { class: 'bubble' }, h('div', { class: 'who' }, '🧑‍🏫'), h('div', { class: 'txt big-say' }, say)));
    const spoken = speak(say);
    if (scene.kind !== 'real') prep(scene);
    const parentBox = h('div', { class: 'parent-note' }, h('b', null, '家长说明：'), h('div', { html: lesson!.parent }));

    if (scene.kind === 'talk') {
      side.append(h('div', { class: 'btn-row' }, keyBtn('btn green', '懂了 👉', '空格', next)), keys(say, { space: next, right: next }, [['空格', '继续']]));
    }

    if (scene.kind === 'watch') {
      const steps = scene.steps;
      const all = steps.map((s) => s.moves).join(' ');
      const av = algView(all);
      const stepBox = h('div', { class: 'step-say' }, '👀 看好了……');
      const actions = h('div', { class: 'btn-row' });
      const hintRow = h('div');
      const setup = resolveSetup(scene.setup);
      const canFollow = parseAlg(all).length <= FOLLOW_MAX && parseAlg(setup).length <= FOLLOW_MAX;
      side.append(stepBox, av.el, actions, hintRow);

      const offsets: number[] = [];
      let acc = 0;
      for (const s of scene.steps) {
        offsets.push(acc);
        acc += parseAlg(s.moves).length;
      }

      const done = () => {
        stepBox.textContent = canFollow ? '拿起你的魔方，按 2 跟着做一遍！' : '看懂了吗？';
        if (canFollow) speak('拿起你的魔方，按 2，跟着做一遍！');
        actions.replaceChildren(
          keyBtn('btn ghost', '🔁 再看', '1', playAll),
          canFollow ? keyBtn('btn blue', '🧊 跟着做', '2', followAll) : '',
          keyBtn('btn green', '下一个 👉', '空格', next),
        );
        hintRow.replaceChildren(keys(say, { space: next, right: next, back: playAll, '1': playAll, '2': canFollow ? followAll : undefined }, []));
      };

      async function playAll(): Promise<void> {
        const mine = ++gen;
        actions.replaceChildren();
        hintRow.replaceChildren(keys(say, { space: next, right: next }, [['空格', '跳过']]));
        view.setAlg(setup);
        av.at(-1);
        for (let i = 0; i < steps.length; i++) {
          if (!alive || mine !== gen) return;
          const s = steps[i];
          stepBox.textContent = withNicks(s.say);
          await speak(stepBox.textContent);
          if (!alive || mine !== gen) return;
          const n = parseAlg(s.moves).length;
          // 一段做完时先不要把下一段标成"正在做"，最后一段做完才全部标完成
          await playWithArrows(view, s.moves, (j) => (j < n || i === steps.length - 1) && av.at(offsets[i] + j));
          await wait(500);
        }
        if (alive && mine === gen) done();
      }

      async function followAll(): Promise<void> {
        const mine = ++gen;
        actions.replaceChildren();
        hintRow.replaceChildren(keyHints([['空格', '我转好了'], ['Esc', '回地图']]));
        av.at(-1);
        if (setup) {
          stepBox.textContent = `拿起魔方，白色朝下、${faceName('F')}色朝前。先跟我摆出这个样子！`;
          await speak(stepBox.textContent);
          if (!(await follow(setup, '', stepBox, mine))) return;
          stepBox.textContent = '摆好了！现在跟我把它变回去。';
          await speak(stepBox.textContent);
        }
        if (!(await follow(all, setup, stepBox, mine))) return;
        beep('good');
        stepBox.textContent = '🎉 你跟着做完了！';
        await speak('你跟着做完了！');
        if (alive && mine === gen) done();
      }

      hintRow.append(keys(say, { space: next, right: next }, [['空格', '跳过']]));
      spoken.then(() => {
        if (alive && my === gen) playAll();
      });
      if (setup) parentBox.append(h('p', null, '这个情况的摆法：从复原的魔方做 ', h('span', { class: 'alg' }, setup), '。'));
    }

    if (scene.kind === 'try') {
      const setup = resolveSetup(scene.setup);
      const hintToks = tryParse(scene.hint);
      let hintOn = false;
      let hintPos = 0;
      let count = 0;
      let finished = false;
      const status = h('div', { class: 'step-say' }, '用键盘转屏幕上的魔方：按 R 就是 R，Shift+R 就是 R\'');
      const pad = movePad(scene.moves, async (m) => {
        if (finished || view.busy || my !== gen) return;
        count++;
        if (hintOn && hintToks) {
          if (m === hintToks[hintPos]) hintPos++;
          else hintOn = false;
        }
        pad.mark(null);
        view.showArrow(null);
        await view.play(m);
        if (checkGoal(view.state, scene.goal)) {
          finished = true;
          celebrate('成功啦！');
          status.textContent = `🎉 用了 ${count} 步！`;
          await speak('成功啦！');
          if (alive && my === gen) next();
          return;
        }
        if (hintOn && hintToks && hintPos < hintToks.length) {
          pad.mark(hintToks[hintPos]);
          view.showArrow(hintToks[hintPos]);
          speak(`下一步，${hintToks[hintPos]}`);
        }
        if (count === 12 && !hintOn) {
          status.textContent = '有点难？按 H 看提示，或者按退格键重来。';
          speak('有点难？按 H 看提示');
        }
      });
      const reset = () => {
        view.setAlg(setup);
        count = 0;
        hintOn = false;
        pad.mark(null);
        view.showArrow(null);
        status.textContent = '重新开始！';
      };
      const hint = () => {
        mistakes++;
        if (!hintToks) {
          status.textContent = `💡 ${scene.hint}`;
          speak(scene.hint, true);
          return;
        }
        reset();
        hintOn = true;
        hintPos = 0;
        pad.mark(hintToks[0]);
        view.showArrow(hintToks[0]);
        status.textContent = '💡 跟着粉色箭头转！';
        speak(`第一步，${hintToks[0]}，${kidWords(hintToks[0])}`, true);
      };
      side.append(
        status,
        pad.el,
        h('div', { class: 'btn-row' }, keyBtn('btn ghost', '💡 提示', 'H', hint), keyBtn('btn ghost', '🔁 重来', '⌫', reset)),
        keys(say, { hint, back: reset, right: next }, [['H', '提示'], ['⌫', '重来'], ['→', '跳过']]),
      );
      parentBox.append(h('p', null, '参考解法：', h('span', { class: 'alg' }, scene.hint)));
    }

    if (scene.kind === 'pick') {
      const rounds = scene.rounds ?? 1;
      let round = 0;
      const status = h('div', { class: 'step-say' }, rounds > 1 ? `第 1 / ${rounds} 题：用鼠标点魔方` : '用鼠标点魔方上的方块');
      const hint = () => {
        mistakes++;
        view.glow(scene.answer(view.state));
        setTimeout(() => my === gen && view.glow([]), 1200);
      };
      const setRound = () => {
        if (round > 0) prep(scene);
        view.onPick((pid) => {
          if (!alive || my !== gen) return;
          if (scene.answer(view.state).includes(pid)) {
            beep('good');
            view.highlight([...(scene.highlight ?? []), pid]);
            round++;
            if (round >= rounds) {
              view.onPick(null);
              celebrate('找到啦！');
              setTimeout(() => alive && my === gen && next(), 1100);
            } else {
              status.textContent = `✅ 对！第 ${round + 1} / ${rounds} 题`;
              setTimeout(() => alive && my === gen && setRound(), 700);
            }
          } else {
            mistakes++;
            beep('bad');
            status.textContent = '再找找～ 可以拖动魔方看背面哦';
            speak('再找找');
          }
        });
      };
      setRound();
      side.append(status, keys(say, { hint, right: next }, [['H', '闪一下答案'], ['→', '跳过']]));
    }

    if (scene.kind === 'quiz') {
      const rounds = scene.rounds ?? 1;
      let round = 0;
      const box = h('div', { class: 'options' });
      const status = h('div', { class: 'step-say' }, rounds > 1 ? `第 1 / ${rounds} 题：按数字键选` : '按数字键选答案');
      const hintRow = h('div');
      const ask = (first: boolean) => {
        let opts: { label: string; ok: boolean }[];
        if (typeof scene.options === 'function') {
          const g = scene.options();
          view.setAlg(g.setup);
          view.resetView();
          opts = g.options;
        } else opts = scene.options;
        let locked = false;
        const choose = (i: number) => {
          const o = opts[i];
          const b = box.children[i] as HTMLElement | undefined;
          if (!o || !b || locked) return;
          if (o.ok) {
            locked = true;
            b.classList.add('ok');
            beep('good');
            round++;
            if (round >= rounds) {
              celebrate('答对啦！');
              setTimeout(() => alive && my === gen && next(), 1100);
            } else {
              status.textContent = `✅ 对！第 ${round + 1} / ${rounds} 题`;
              setTimeout(() => alive && my === gen && ask(false), 700);
            }
          } else {
            mistakes++;
            beep('bad');
            b.classList.add('no');
            setTimeout(() => b.classList.remove('no'), 400);
          }
        };
        box.replaceChildren(
          ...opts.map((o, i) => {
            const b = h('button', { class: 'option' }, h('kbd', { class: 'num' }, String(i + 1)), withNicks(o.label));
            b.onclick = () => choose(i);
            return b;
          }),
        );
        // 不认字也能答：把选项读出来
        const readOpts = opts.map((o, i) => `${i + 1}，${withNicks(o.label)}`).join('。');
        if (first)
          spoken.then(() => {
            if (alive && my === gen) speak(readOpts);
          });
        else speak(readOpts);
        hintRow.replaceChildren(
          keys(
            say,
            { '1': () => choose(0), '2': () => choose(1), '3': () => choose(2), '4': () => choose(3), voice: () => speak(`${say}。${readOpts}`, true), right: next },
            [[`1~${opts.length}`, '选答案']],
          ),
        );
      };
      side.append(status, box, hintRow);
      ask(true);
    }

    if (scene.kind === 'real') {
      view.setAlg(scene.parentSetup ?? '');
      view.highlight(null);
      view.showArrow(null);
      st.cover(true, '🧊✋');
      const followBox = h('div', { class: 'step-say' }, '拿起你的魔方！');
      const ps = scene.parentSetup;
      const followSetup = ps
        ? async () => {
            const mine = ++gen;
            followBox.textContent = `白色朝下、${faceName('F')}色朝前，跟我摆！`;
            await speak(followBox.textContent);
            if (!(await follow(ps, '', followBox, mine))) return;
            followBox.textContent = '摆好了！现在自己让好朋友回家吧！做到了就按空格。';
            speak(followBox.textContent);
            setKeys({ space: next, '2': followSetup, voice: () => speak(say, true), esc: toIsland });
          }
        : undefined;
      if (ps) speak(`${say}。按 2，我带你摆出来。`);
      side.append(
        followBox,
        h('div', { class: 'btn-row' }, ps ? keyBtn('btn blue', '🧊 跟我摆', '2', followSetup!) : '', keyBtn('btn green', '我做到了！💪', '空格', next)),
        keys(say, { space: next, '2': followSetup }, []),
      );
      const items = scene.checklist ?? [];
      if (items.length) parentBox.append(h('p', null, h('b', null, '看孩子能不能：')), h('ul', null, ...items.map((t) => h('li', null, t))));
      if (ps) parentBox.append(h('p', null, '摆法：从复原的魔方（白色朝下、', faceName('F'), '色朝前）做 ', h('span', { class: 'alg' }, ps), '，或者让孩子按 2 跟着屏幕一步步摆。'));
    }

    side.append(parentBox);
  }

  function finish(): void {
    gen++;
    view.onPick(null);
    view.showArrow(null);
    view.highlight(null);
    st.cover(false);
    const stars = mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1;
    giveStars(lesson!.id, stars);
    setDots();
    celebrate(starsText(stars));
    const i = LESSONS.findIndex((l) => l.id === lesson!.id);
    const nextLesson = LESSONS[i + 1];
    speak(`闯关成功！你得到了 ${stars} 颗星星。按空格，${nextLesson ? '去下一关' : '回首页'}。`);
    const again = () => {
      mistakes = 0;
      goto(0);
    };
    const toNext = () => (location.hash = nextLesson ? `#/lesson/${nextLesson.id}` : '#/');
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
          keyBtn('btn ghost', '🔁 再玩一次', '⌫', again),
          keyBtn('btn ghost', '🗺️ 地图', 'Esc', toIsland),
          keyBtn('btn green', nextLesson ? `下一关 ${nextLesson.emoji}` : '回首页', '空格', toNext),
        ),
      ),
    );
    setKeys({ space: toNext, right: toNext, back: again, esc: toIsland });
    view.setAlg('');
    view.play('y y y y', 500, true);
  }

  show();
  return () => {
    alive = false;
    gen++;
    clearKeys();
    stopSpeak();
    view.dispose();
  };
}
