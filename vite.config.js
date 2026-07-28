import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const outDir = 'dist';
      const dirsToCopy = ['js', 'css'];
      for (const dir of dirsToCopy) {
        if (fs.existsSync(dir)) {
          copyDir(dir, path.join(outDir, dir));
        }
      }
      // Also copy other static files
      const filesToCopy = ['vercel.json'];
      for (const file of filesToCopy) {
        if (fs.existsSync(file)) {
          fs.copyFileSync(file, path.join(outDir, file));
        }
      }
      console.log('Static assets copied to dist/');
    }
  };
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  plugins: [copyStaticAssets()]
});
