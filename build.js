#!/usr/bin/env node
// Builds the installable GitHub Pages copy from app.html, which is also published
// as-is as the Claude artifact. Run after every change: node build.js
//  - index.html: app.html wrapped in a full page, plus the home-screen tags
//  - a build stamp (hash of app.html + data.js) in index.html, version.json and sw.js,
//    so installed apps notice any change and reload themselves
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dir = __dirname;
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

const app = read('app.html');
const data = read('data.js');
const m = data.match(/const VERSION = '([^']+)'/);
if (!m) throw new Error('VERSION not found in data.js');
const build = crypto.createHash('sha256').update(app).update(data).digest('hex').slice(0, 10);

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#161616">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Waaagh Codex">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px)}img{max-width:100%}</style>
<script>window.WH_BUILD = '${build}';</script>
</head>
<body>
`;
const body = app.replace('<script src="data.js"></script>', `<script src="data.js?v=${build}"></script>`);
fs.writeFileSync(path.join(dir, 'index.html'), head + body + '\n</body>\n</html>\n');
fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version: build, data: m[1] }) + '\n');
const sw = read('sw.js').replace(/const VERSION = '[^']*';/, `const VERSION = '${build}';`);
fs.writeFileSync(path.join(dir, 'sw.js'), sw);
console.log('built', build, '(data ' + m[1] + ')');
