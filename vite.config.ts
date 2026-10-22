import { defineConfig } from 'vite';

// GitHub Pages 部署在 /<仓库名>/ 下，所以用相对路径
export default defineConfig({
  base: './',
});
