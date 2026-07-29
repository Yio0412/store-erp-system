const fs = require('fs');
const path = require('path');

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

const root = '.';
const distDir = 'dist';

if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

const skipItems = [
    'node_modules', 'dist', '.git', '.gitignore',
    'build.js', 'package.json', 'package-lock.json',
    'push-to-github.js', 'vite.config.js', 'vercel.json',
    'public', 'README.md'
];

const items = fs.readdirSync(root, { withFileTypes: true });
for (const item of items) {
    if (skipItems.includes(item.name) || item.name.startsWith('.')) continue;
    if (item.isDirectory()) {
        copyDir(item.name, path.join(distDir, item.name));
    } else {
        fs.copyFileSync(item.name, path.join(distDir, item.name));
    }
}

console.log('Build complete: files copied to dist/');
console.log('Files in dist:');
function listDir(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        console.log(prefix + e.name);
        if (e.isDirectory()) listDir(path.join(dir, e.name), prefix + '  ');
    }
}
listDir(distDir, '  ');
