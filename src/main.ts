import './scheme';
import './style.css';
import { homePage, islandPage } from './pages/home';
import { lessonPage } from './pages/lesson';
import { gamePage } from './pages/games';
import { timerPage } from './pages/timer';
import { parentPage } from './pages/parent';
import { labPage } from './pages/lab';
import { bookPage } from './pages/book';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

function route(): void {
  cleanup?.();
  app.replaceChildren();
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
