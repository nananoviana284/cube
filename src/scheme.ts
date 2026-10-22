// 必须最先加载：课程文字里的颜色名字依赖当前配色
import { setFrontColor } from './cube/model';
import { load } from './store';

setFrontColor(load().front);
