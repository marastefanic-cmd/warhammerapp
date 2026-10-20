#!/usr/bin/env node
// Builds the installable GitHub Pages copy from app.html, which is also published
// as-is as the Claude artifact. Run after every change: node build.js
//  - first runs check.js over data.js and stops if anything is inconsistent
//  - then refuses to build unless verify/report.json says this exact app.html + data.js passed
//    every verification (node verify/run.js: BSData, the New Recruit PDFs, GW's rules text,
//    mechanical rules, every screen, and the sign-off of every judgement the app adds)
//  - index.html: app.html wrapped in a full page, plus the home-screen tags
//  - a build stamp (hash of app.html + data.js) in index.html, version.json and sw.js,
//    so installed apps notice any change and reload themselves
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dir = __dirname;
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

// stop before building if data.js has a mistake (see check.js)
const problems = require('./check.js')(path.join(dir, 'data.js'));
if (problems.length) { problems.forEach(p => console.error(' -', p)); throw new Error(problems.length + ' problem(s) in data.js'); }

const app = read('app.html');
const data = read('data.js');

// the gate: only a verified app.html + data.js is built (node verify/run.js writes the report).
// verify/run.js itself builds with VERIFY_BUILDING=1 to check the screens of the page it is about to verify.
if (!process.env.VERIFY_BUILDING) {
  let report = null;
  try { report = JSON.parse(read('verify/report.json')); } catch (e) {}
  const hash = crypto.createHash('sha256').update(app + data).digest('hex');
  if (!report || report.hash !== hash) throw new Error('not verified: app.html or data.js changed since the last verification. Run: node verify/run.js');
  if (!report.ok) throw new Error('verification failed (see verify/report.json). Fix it, then run: node verify/run.js');
}
const m = data.match(/const VERSION = '([^']+)'/);
if (!m) throw new Error('VERSION not found in data.js');
const build = crypto.createHash('sha256').update(app).update(data).digest('hex').slice(0, 10);

// the page's <title> and font links belong in <head>; the artifact-only meta tag is dropped
const hoist = [];
let body = app.replace(/^(<title>.*<\/title>|<link [^>]*>|<meta [^>]*>)\n/gm, (line, tag) => {
  if (!tag.startsWith('<meta')) hoist.push(tag);   // charset is already in the head; claude: tags are artifact-only
  return '';
});
const tag = '<script src="data.js"></script>';
if (!body.includes(tag)) throw new Error('data.js script tag not found in app.html');
body = body.replace(tag, `<script src="data.js?v=${build}"></script>`);
body = body.replace('<script src="verified.js"></script>', `<script src="verified.js?v=${build}"></script>`);

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#161616">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Kodex">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px)}img{max-width:100%}</style>
${hoist.join('\n')}
<script>window.WH_BUILD = '${build}';</script>
</head>
<body>
`;
fs.writeFileSync(path.join(dir, 'index.html'), head + body + '\n</body>\n</html>\n');
fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version: build, data: m[1] }) + '\n');
const sw = read('sw.js').replace(/const VERSION = '[^']*';/, `const VERSION = '${build}';`);
fs.writeFileSync(path.join(dir, 'sw.js'), sw);
console.log('built', build, '(data ' + m[1] + ')');
