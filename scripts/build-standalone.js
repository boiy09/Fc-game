#!/usr/bin/env node
/* ============================================================
   DOOMVIVOR 단일 HTML 빌드
   index.html + style.css + game.js + assets(폰트/텍스처)를
   모두 인라인·base64 임베드해서 dist/doomvivor.html 하나로 생성.
   → 서버 없이 파일 더블클릭(file://)만으로 실행 가능.

   사용: node scripts/build-standalone.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const p = (...a) => path.join(ROOT, ...a);
const b64 = f => fs.readFileSync(p(f)).toString('base64');

// 1) 소스 읽기
let html = fs.readFileSync(p('index.html'), 'utf8');
let css  = fs.readFileSync(p('style.css'), 'utf8');
const js = fs.readFileSync(p('game.js'), 'utf8');

// 2) 폰트를 CSS에 data URI로 임베드
const fontB64 = b64('assets/fonts/PressStart2P.ttf');
css = css.replace(
  /url\(['"]?assets\/fonts\/PressStart2P\.ttf['"]?\)/,
  `url('data:font/ttf;base64,${fontB64}')`
);

// 3) 텍스처를 data URI로 임베드하는 주입 스크립트
const assets = {
  wallDark: `data:image/png;base64,${b64('assets/textures/wall_dark.png')}`,
  wallRed:  `data:image/png;base64,${b64('assets/textures/wall_red.png')}`,
};
const inject = `window.__DOOMVIVOR_ASSETS = ${JSON.stringify(assets)};`;

// 4) 인라인 치환
if (!html.includes('href="style.css"') || !html.includes('src="game.js"')) {
  console.error('❌ index.html에서 style.css/game.js 링크를 찾지 못했습니다.');
  process.exit(1);
}
html = html.replace(
  /<link rel="stylesheet" href="style\.css"\s*\/?>/,
  `<style>\n${css}\n</style>`
);
html = html.replace(
  /<script src="game\.js"><\/script>/,
  `<script>\n${inject}\n${js}\n</script>`
);

// 5) 출력
const outDir = p('dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'doomvivor.html');
fs.writeFileSync(out, html);

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`✅ 빌드 완료: dist/doomvivor.html (${kb} KB, 단일 파일 · 외부 요청 0)`);
