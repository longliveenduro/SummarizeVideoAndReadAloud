import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

async function build() {
  console.log('Building YouTube Gemini Summarizer & TTS Extension...');

  // Ensure dist directory exists
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Bundle content.js (IIFE format for Chrome content script isolation)
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'content.js')],
    outfile: path.join(distDir, 'content.bundle.js'),
    bundle: true,
    format: 'iife',
    target: ['chrome110'],
    minify: false
  });

  // Also output bundle to root directory so loading unpacked from root works out of the box!
  fs.copyFileSync(path.join(distDir, 'content.bundle.js'), path.join(rootDir, 'content.bundle.js'));

  // 2. Bundle options.js
  const distOptionsDir = path.join(distDir, 'options');
  fs.mkdirSync(distOptionsDir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(rootDir, 'options/options.js')],
    outfile: path.join(distOptionsDir, 'options.bundle.js'),
    bundle: true,
    format: 'iife',
    target: ['chrome110'],
    minify: false
  });

  fs.copyFileSync(path.join(distOptionsDir, 'options.bundle.js'), path.join(rootDir, 'options/options.bundle.js'));

  // 3. Copy background.js
  fs.copyFileSync(path.join(rootDir, 'background.js'), path.join(distDir, 'background.js'));

  // 4. Copy content.css
  fs.copyFileSync(path.join(rootDir, 'content.css'), path.join(distDir, 'content.css'));

  // 5. Copy options HTML & CSS (point to options.bundle.js in dist)
  let optionsHtml = fs.readFileSync(path.join(rootDir, 'options/options.html'), 'utf-8');
  optionsHtml = optionsHtml.replace('src="options.js"', 'src="options.bundle.js"');
  fs.writeFileSync(path.join(distOptionsDir, 'options.html'), optionsHtml);
  fs.copyFileSync(path.join(rootDir, 'options/options.css'), path.join(distOptionsDir, 'options.css'));

  // 6. Copy icons
  const distIconsDir = path.join(distDir, 'icons');
  fs.mkdirSync(distIconsDir, { recursive: true });
  const iconFiles = fs.readdirSync(path.join(rootDir, 'icons'));
  for (const file of iconFiles) {
    fs.copyFileSync(path.join(rootDir, 'icons', file), path.join(distIconsDir, file));
  }

  // 7. Copy manifest.json
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf-8'));
  fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('Build completed successfully in ./dist and root.');
}

build().catch((err) => {
  console.error('Build error:', err);
  process.exit(1);
});

