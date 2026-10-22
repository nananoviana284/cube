import './scheme';
import './style.css';
import { homePage, islandPage } from './pages/home';
import { lessonPage } from './pages/lesson';
import { gamePage } from './pages/games';
import { timerPage } from './pages/timer';
import { parentPage } from './pages/parent';
import { labPage } from './pages/lab';
import { bookPage } from './pages/book';
import { setKeys } from './ui/keys';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function route(): void {
  cleanup?.();
  app.replaceChildren();
  // 默认 Esc 回首页，各页面可以覆盖
  setKeys({ esc: () => (location.hash = '#/') });
  window.scrollTo(0, 0);
  const [, page, arg] = (location.hash.replace(/^#/, '') || '/').split('/');
  switch (page) {
    case 'island':
      cleanup = islandPage(app, arg);
      break;
    case 'lesson':
      cleanup = lessonPage(app, arg);
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
    case 'book':
      cleanup = bookPage(app);
      break;
    case 'lab':
      cleanup = labPage(app);
      break;
    default:
      cleanup = homePage(app);
  }
}

window.addEventListener('hashchange', route);
route();
