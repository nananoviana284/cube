import './scheme';
import './style.css';
import { homePage, islandPage } from './pages/home';
import { lessonPage } from './pages/lesson';
import { gamePage, gamesHub } from './pages/games';
import { timerPage } from './pages/timer';
import { parentPage } from './pages/parent';
import { labPage } from './pages/lab';
import { bookPage } from './pages/book';
import { formulaPage } from './pages/formula';
import { setKeys } from './ui/keys';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function route(): void {
  cleanup?.();
  app.replaceChildren();
  // 每页自己加需要的 body 样式（家长说明、家长中心冷色底）
  document.body.className = '';
  // 默认 Esc 回首页，各页面可以覆盖
  setKeys({ esc: () => (location.hash = '#/') });
  window.scrollTo(0, 0);
  const [, page, arg] = (location.hash.replace(/^#/, '') || '/').split('/');
  switch (page) {
    case 'island':
      cleanup = islandPage();
      break;
    case 'lesson':
      cleanup = lessonPage(app, arg);
      break;
    case 'games':
      cleanup = gamesHub(app);
      break;
    case 'game':
      cleanup = gamePage(app, arg);
      break;
    case 'timer':
      cleanup = timerPage(app);
      break;
    case 'parent':
      cleanup = parentPage(app);
      break;
    case 'learn':
      cleanup = homePage(app);
      break;
    case 'f':
      cleanup = formulaPage(app, arg);
      break;
    case 'book':
      // 旧链接：公式本现在就是首页
      location.replace('#/');
      break;
    case 'lab':
      cleanup = labPage(app);
      break;
    default:
      cleanup = bookPage(app);
  }
}

window.addEventListener('hashchange', route);
route();
