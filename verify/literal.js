// A reader and writer for the JavaScript literals data.js is made of (objects, arrays, strings, numbers,
// regular expressions, // comments), keeping each comment with the value it sits on, and where every value is.
// verify/tables.js uses it to rewrite data.js's tables without losing a comment.
//
//   parse(src, at)  the literal starting at src[at] (after blanks and comments) →
//                   { value, end, nodes, comments }
//     nodes:    every value, and every property key, in source order: { path, pos, end, line }
//               (path: an array of keys and indices from the literal's root; a property is its key's path)
//     comments: { [JSON path]: { above:[text], inline:[text] } }: a comment on lines of its own belongs to the
//               value (or property) that starts next; one after code on a line to the first value starting on
//               that line. text is what follows the //.
//   lit(v)          a value as data.js writes it on one line: 'single quotes', { key:value }, [a,b]
'use strict';

function parse(src, at){
  let i = at || 0;
  const lineStarts = [0];
  for(let k = 0; k < src.length; k++) if(src.charCodeAt(k) === 10) lineStarts.push(k + 1);
  const lineOf = pos => { let lo = 0, hi = lineStarts.length - 1; while(lo < hi){ const mid = (lo + hi + 1) >> 1; if(lineStarts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
  const nodes = [], raw = [];
  const fail = msg => { const l = lineOf(i); throw new Error('data.js line ' + (l + 1) + ': ' + msg + ' near «' + src.slice(i, i + 40) + '»'); };
  function blanks(){
    for(;;){
      const c = src[i];
      if(c === ' ' || c === '\t' || c === '\n' || c === '\r'){ i++; continue; }
      if(c === '/' && src[i + 1] === '/'){
        const s = i, e = src.indexOf('\n', i), stop = e < 0 ? src.length : e;
        const l = lineOf(s), own = /^\s*$/.test(src.slice(lineStarts[l], s));
        raw.push({ pos:s, line:l, own, text:src.slice(s + 2, stop).replace(/\s+$/, '') });
        i = stop; continue;
      }
      if(c === '/' && src[i + 1] === '*'){ const e = src.indexOf('*/', i + 2); if(e < 0) fail('unclosed comment'); i = e + 2; continue; }
      return;
    }
  }
  function str(){
    const q = src[i++]; let out = '';
    for(;;){
      const c = src[i++];
      if(c === undefined) fail('unclosed string');
      if(c === q) return out;
      if(c === '\n') fail('line break in a string');
      if(c !== '\\'){ out += c; continue; }
      const e = src[i++];
      if(e === 'n') out += '\n'; else if(e === 't') out += '\t'; else if(e === 'r') out += '\r';
      else if(e === 'u'){
        if(src[i] === '{'){ const c2 = src.indexOf('}', i); out += String.fromCodePoint(parseInt(src.slice(i + 1, c2), 16)); i = c2 + 1; }
        else { out += String.fromCharCode(parseInt(src.slice(i, i + 4), 16)); i += 4; }
      }
      else if(e === 'x'){ out += String.fromCharCode(parseInt(src.slice(i, i + 2), 16)); i += 2; }
      else if(e === '\n') {}
      else out += e;
    }
  }
  function regex(){
    const s = i++; let cls = false;
    for(;;){
      const c = src[i++];
      if(c === undefined || c === '\n') fail('unclosed regular expression');
      if(c === '\\'){ i++; continue; }
      if(c === '[') cls = true; else if(c === ']') cls = false; else if(c === '/' && !cls) break;
    }
    const body = src.slice(s + 1, i - 1); let flags = '';
    while(/[a-z]/.test(src[i])) flags += src[i++];
    return new RegExp(body, flags);
  }
  function value(path){
    blanks();
    const node = { path, pos:i, line:lineOf(i) }; nodes.push(node);
    const c = src[i]; let v;
    if(c === '{'){
      i++; v = {};
      for(;;){
        blanks();
        if(src[i] === '}'){ i++; break; }
        const kpos = i; let k;
        if(src[i] === '\'' || src[i] === '"') k = str();
        else { const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(src.slice(i, i + 200)); if(!m) fail('a key'); k = m[0]; i += k.length; }
        const pnode = { path:path.concat(k), pos:kpos, line:lineOf(kpos), prop:true }; nodes.push(pnode);
        blanks(); if(src[i] !== ':') fail('":"'); i++;
        v[k] = value(path.concat(k)); pnode.end = i;
        blanks(); if(src[i] === ','){ i++; continue; } if(src[i] === '}'){ i++; break; } fail('"," or "}"');
      }
    } else if(c === '['){
      i++; v = [];
      for(;;){
        blanks();
        if(src[i] === ']'){ i++; break; }
        v.push(value(path.concat(v.length)));
        blanks(); if(src[i] === ','){ i++; continue; } if(src[i] === ']'){ i++; break; } fail('"," or "]"');
      }
    } else if(c === '\'' || c === '"') v = str();
    else if(c === '/') v = regex();
    else {
      const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|true|false|null|undefined)/.exec(src.slice(i, i + 40));
      if(!m) fail('a value');
      i += m[0].length;
      v = m[0] === 'true' ? true : m[0] === 'false' ? false : m[0] === 'null' ? null : m[0] === 'undefined' ? undefined : Number(m[0]);
    }
    node.end = i;
    return v;
  }
  const v = value([]);
  const end = i;
  // comments: own-line ones go with the next value or key, the others with the first one starting on their line
  // (a property's key comes before its value: the key is what the comment is on)
  const comments = {};
  const at2 = (n, where, text) => { const k = JSON.stringify(n.path); (comments[k] = comments[k] || { above:[], inline:[] })[where].push(text); };
  const sorted = nodes.slice().sort((a, b) => a.pos - b.pos || (a.prop ? -1 : 1));
  for(const c of raw){
    if(c.pos > end) continue;
    if(c.own){
      const n = sorted.find(x => x.pos > c.pos);
      if(!n) throw new Error('data.js line ' + (c.line + 1) + ': a comment at the end of a literal (nothing after it to belong to): //' + c.text);
      at2(n, 'above', c.text);
    } else {
      let n = sorted.find(x => x.line === c.line);
      if(!n){ n = sorted.filter(x => x.pos < c.pos).pop(); }
      at2(n, 'inline', c.text);
    }
  }
  return { value:v, end, nodes, comments };
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const q = s => '\'' + String(s).replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '\'';
function lit(v){
  if(Array.isArray(v)) return '[' + v.map(lit).join(',') + ']';
  if(v instanceof RegExp) return String(v);
  if(v && typeof v === 'object'){ const e = Object.entries(v); return e.length ? '{ ' + e.map(([k, x]) => (IDENT.test(k) ? k : q(k)) + ':' + lit(x)).join(', ') + ' }' : '{}'; }
  if(typeof v === 'string') return q(v);
  if(v === undefined) return 'undefined';
  return JSON.stringify(v);
}
const key = k => IDENT.test(k) ? k : q(k);

module.exports = { parse, lit, key, q };
