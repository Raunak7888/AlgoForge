#!/usr/bin/env bash
#
# apply-phase9.sh  -  Phase 9: Sharing and public link resolution
#
# Run from the REPO ROOT:   bash apply-phase9.sh [--run-checks] [--no-git]
#
#   --run-checks   after applying, run phase5 backfill/verify, install, db:generate,
#                  typecheck, lint, test and build (in that order, stops on first failure)
#   --no-git       do not create the phase9-sharing branch / checkpoint commit
#
# What it does
#   * creates every NEW file and every FULL REPLACEMENT file from the Phase 9 write-up
#   * applies the EDITS to existing files with anchored, idempotent patches
#     (running it twice is safe: already-applied edits are reported and skipped)
#   * anything it could not patch automatically is written to ./PHASE9_MANUAL_STEPS.md
#     together with the exact snippet to paste
#
# It never touches .env and never runs migrations.
# Nothing here has been run against your repo: review `git diff` before committing.
#
set -uo pipefail

RUN_CHECKS=0
SKIP_GIT=0
for a in "$@"; do
  case "$a" in
    --run-checks) RUN_CHECKS=1 ;;
    --no-git) SKIP_GIT=1 ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "Unknown option: $a" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
command -v node >/dev/null 2>&1 || { echo "node is required (it is used to apply the edits)." >&2; exit 1; }

API_SRC="${API_SRC:-apps/api/src}"
CON="${CONTRACTS_SRC:-packages/contracts/src}"

if [ ! -f package.json ] || [ ! -d "$API_SRC" ] || [ ! -d "$CON" ]; then
  echo "Run this from the repo root (expected package.json, $API_SRC and $CON)." >&2
  exit 1
fi
API="$API_SRC"

# Web source root = the folder that contains lib/api/endpoints.ts
if [ -z "${WEB_SRC:-}" ]; then
  for c in apps/web/src apps/web; do
    if [ -f "$c/lib/api/endpoints.ts" ]; then WEB_SRC="$c"; break; fi
  done
fi
if [ -z "${WEB_SRC:-}" ]; then
  found="$(find . -path '*/node_modules' -prune -o -path '*/lib/api/endpoints.ts' -print 2>/dev/null | head -1)"
  if [ -n "$found" ]; then WEB_SRC="$(dirname "$(dirname "$(dirname "$found")")")"; WEB_SRC="${WEB_SRC#./}"; fi
fi
if [ -z "${WEB_SRC:-}" ]; then
  echo "Could not find the web app (lib/api/endpoints.ts). Re-run with WEB_SRC=path/to/web/src" >&2
  exit 1
fi
WEB="$WEB_SRC"
if [ -d "$WEB/app" ]; then WEB_APP="$WEB/app"; else WEB_APP="$WEB/app"; fi
WEB_ROOT="$WEB"
for d in "$WEB" "$(dirname "$WEB")"; do
  if ls "$d"/next.config.* >/dev/null 2>&1; then WEB_ROOT="$d"; break; fi
done

echo "API source:       $API"
echo "Contracts source: $CON"
echo "Web source:       $WEB"
echo "Web root:         $WEB_ROOT"
echo

# ---------------------------------------------------------------------------
# Step 1: backup / checkpoint
# ---------------------------------------------------------------------------
if [ "$SKIP_GIT" -eq 0 ] && git rev-parse --git-dir >/dev/null 2>&1; then
  echo "==> Git checkpoint"
  git switch -c phase9-sharing 2>/dev/null || git switch phase9-sharing 2>/dev/null || true
  git add -A && git commit -q -m "checkpoint before phase 9" --allow-empty || true
  echo "    (database backup is up to you, e.g.:"
  echo "     docker compose exec -T postgres pg_dump -U <user> algoforge > backup-before-phase9.sql)"
  echo
fi

# ---------------------------------------------------------------------------
# Edit helper (node). Written to a temp dir.
# ---------------------------------------------------------------------------
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
EDIT="$WORK/edit.js"
export P9_MANUAL="$WORK/manual.md"
: > "$P9_MANUAL"
FAILS=0

cat > "$EDIT" <<'P9JS'
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const op = argv[0];
const fileArg = argv[1];
const rest = argv.slice(2);
const opts = {};
const pos = [];
for (const a of rest) {
  const m = /^--([a-z]+)(?:=([\s\S]*))?$/.exec(a);
  if (m) opts[m[1]] = m[2] === undefined ? true : m[2];
  else pos.push(a);
}

const MANUAL = process.env.P9_MANUAL || '';
const STDIN_OPS = new Set(['write', 'insert_after_line', 'insert_before_line', 'add_import', 'after_imports',
  'replace_member', 'insert_after_member', 'add_to_object', 'append', 'routes9']);

let _in = null;
function stdin() {
  if (_in === null) { try { _in = fs.readFileSync(0, 'utf8'); } catch (e) { _in = ''; } }
  return _in;
}

function ok(msg) { console.log('  ✓ ' + msg); }
function skip(msg) { console.log('  · ' + msg); }
function fail(file, msg, snippet) {
  console.log('  ✗ ' + file + ': ' + msg);
  if (MANUAL) {
    fs.appendFileSync(MANUAL, '### ' + file + '\n' + msg + '\n' +
      (snippet ? '```\n' + String(snippet).replace(/\s+$/, '') + '\n```\n' : '') + '\n');
  }
  process.exitCode = 1;
}
const snippetOf = () => (STDIN_OPS.has(op) ? stdin() : op + ' :: ' + pos.join('  ->  '));

// ---------- file lookup ----------
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo', '.pnpm-store', '.cache']);
let _files = null;
function allFiles() {
  if (_files) return _files;
  _files = [];
  const walk = (d) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(d, e.name)); }
      else _files.push(path.join(d, e.name).split(path.sep).join('/'));
    }
  };
  walk('.');
  return _files;
}
function resolveFile(f) {
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  const segs = f.split('/').filter(Boolean);
  for (let n = Math.min(3, segs.length); n >= 1; n--) {
    const suffix = '/' + segs.slice(-n).join('/');
    const hits = allFiles().filter((p) => ('/' + p).endsWith(suffix));
    if (hits.length === 1) return hits[0];
  }
  return null;
}

// ---------- source scanning ----------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lineStart = (s, i) => s.lastIndexOf('\n', i - 1) + 1;
const leadingWs = (line) => /^[ \t]*/.exec(line)[0];

function skipStr(s, i, q) {
  for (let k = i + 1; k < s.length; k++) {
    if (s[k] === '\\') { k++; continue; }
    if (s[k] === q) return k;
    if (s[k] === '\n') return k;
  }
  return s.length;
}
function skipTpl(s, i) {
  for (let k = i + 1; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') { k++; continue; }
    if (c === '`') return k;
    if (c === '$' && s[k + 1] === '{') {
      let d = 1; k += 2;
      for (; k < s.length; k++) {
        const x = s[k];
        if (x === '"' || x === "'") k = skipStr(s, k, x);
        else if (x === '`') k = skipTpl(s, k);
        else if (x === '{') d++;
        else if (x === '}') { d--; if (d === 0) break; }
      }
    }
  }
  return s.length;
}
function endOfStmt(s, k) {
  let j = k;
  while (s[j] === ' ' || s[j] === '\t') j++;
  if (s[j] === ';' || s[j] === ',') j++;
  return j;
}
// End (exclusive) of the member/statement that starts at i. -1 when it cannot be determined.
function scanEnd(s, i) {
  let depth = 0, seen = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k], n = s[k + 1];
    if (c === '/' && n === '/') { const e = s.indexOf('\n', k); if (e < 0) return -1; k = e; continue; }
    if (c === '/' && n === '*') { const e = s.indexOf('*/', k + 2); if (e < 0) return -1; k = e + 1; continue; }
    if (c === '"' || c === "'") { k = skipStr(s, k, c); continue; }
    if (c === '`') { k = skipTpl(s, k); continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; seen = true; continue; }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth < 0) return -1;
      if (depth === 0 && c === '}') return endOfStmt(s, k + 1);
      continue;
    }
    if (depth === 0 && c === ';') return k + 1;
    if (depth === 0 && c === ',' && seen) return k + 1;
  }
  return -1;
}
// Index of the bracket that closes the one at `open`.
function matchClose(s, open) {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    const c = s[k], n = s[k + 1];
    if (c === '/' && n === '/') { const e = s.indexOf('\n', k); if (e < 0) return -1; k = e; continue; }
    if (c === '/' && n === '*') { const e = s.indexOf('*/', k + 2); if (e < 0) return -1; k = e + 1; continue; }
    if (c === '"' || c === "'") { k = skipStr(s, k, c); continue; }
    if (c === '`') { k = skipTpl(s, k); continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) return k; }
  }
  return -1;
}
function startRe(name) {
  return new RegExp('^[ \\t]*(?:(?:export|default|public|private|protected|static|readonly|async|declare|abstract|const|let|var|function|interface|type)\\s+)*' +
    esc(name) + '\\b\\s*(?:[(=:<{]|$)', 'm');
}
function findBlock(src, re) {
  const m = re.exec(src);
  if (!m) return null;
  const start = lineStart(src, m.index);
  const end0 = scanEnd(src, start);
  if (end0 < 0) return null;
  let end = end0;
  const nl = src.indexOf('\n', end);
  if (nl >= 0 && /^[ \t]*$/.test(src.slice(end, nl))) end = nl + 1;
  else if (nl < 0) end = src.length;
  let s = start;
  for (;;) {
    if (s === 0) break;
    const prevEnd = s - 1;
    const prevStart = lineStart(src, prevEnd);
    const line = src.slice(prevStart, prevEnd).trim();
    if (line.startsWith('//')) { s = prevStart; continue; }
    if (line.endsWith('*/')) {
      const open = src.lastIndexOf('/*', prevEnd);
      if (open < 0) break;
      if (src.indexOf('*/', open + 2) !== src.lastIndexOf('*/', prevEnd)) break;
      if (src.slice(lineStart(src, open), open).trim() !== '') break;
      s = lineStart(src, open);
      continue;
    }
    break;
  }
  return { start: s, end, text: src.slice(s, end) };
}
function cutBlock(src, fb) {
  const before = src.slice(0, fb.start);
  let after = src.slice(fb.end);
  if (before.endsWith('\n\n') && after.startsWith('\n')) after = after.slice(1);
  return before + after;
}
const identsOf = (t) => t.match(/[A-Za-z_$][\w$]*/g) || [];

// ---------- imports ----------
const IMPORT_SRC = '^import\\s+(type\\s+)?(?:([A-Za-z_$][\\w$]*)\\s*,?\\s*)?(?:\\{([^}]*)\\}\\s*)?from\\s*([\'"])([^\'"]+)\\4[ \\t]*;?[ \\t]*\\n?';

function dropUnused(src, idents) {
  for (const id of new Set(idents)) {
    if (id.length < 2) continue;
    const re = new RegExp('(?<![\\w$.])' + esc(id) + '(?![\\w$])', 'g');
    const count = (src.match(re) || []).length;
    if (count !== 1) continue;
    src = src.replace(new RegExp(IMPORT_SRC, 'gm'), (full, typeKw, def, braces) => {
      if (def === id && braces === undefined) return '';
      if (braces === undefined) return full;
      const pieces = braces.split(',');
      const idx = pieces.findIndex((p) => p.trim().replace(/^type\s+/, '') === id);
      if (idx < 0) return full;
      const removed = pieces.splice(idx, 1)[0];
      const left = pieces.filter((p) => p.trim() !== '');
      if (left.length === 0 && !def) return '';
      if (idx === pieces.length && pieces.length) {
        pieces[pieces.length - 1] += /\s*$/.exec(removed)[0];
      }
      return full.replace('{' + braces + '}', '{' + pieces.join(',') + '}');
    });
  }
  return src;
}

function mergeSpecifiers(src, kind, mod, names) {
  const kw = kind === 'export' ? 'export' : 'import(?!\\s+type\\b)';
  const re = new RegExp('(' + kw + '\\s*\\{)([^}]*)(\\}\\s*from\\s*[\'"]' + esc(mod) + '[\'"])', 'g');
  const matches = [...src.matchAll(re)];
  if (!matches.length) return { src, found: false, changed: false };
  const have = new Set();
  for (const m of matches) {
    for (const p of m[2].split(',')) {
      const t = p.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
      if (t) have.add(t);
    }
  }
  const add = names.filter((n) => !have.has(n.trim().replace(/^type\s+/, '')));
  if (!add.length) return { src, found: true, changed: false };
  const m = matches[0];
  const body = m[2];
  const trailing = /\s*$/.exec(body)[0];
  let core = body.slice(0, body.length - trailing.length);
  const multi = body.includes('\n');
  const indent = (/\n([ \t]+)\S/.exec(body) || [null, '    '])[1];
  let out;
  if (multi) {
    if (core.trim() && !core.endsWith(',')) core += ',';
    out = core + add.map((n) => '\n' + indent + n + ',').join('') + (trailing.includes('\n') ? trailing : '\n');
  } else {
    out = core + (core.trim() ? ',' : '') + add.map((n) => ' ' + n).join(',') + (trailing || ' ');
  }
  const start = m.index + m[1].length;
  return { src: src.slice(0, start) + out + src.slice(start + body.length), found: true, changed: true };
}

function insertAfterImports(src, text, blank) {
  const re = new RegExp(IMPORT_SRC, 'gm');
  let last = -1, m;
  while ((m = re.exec(src))) last = m.index + m[0].length;
  const out = text.replace(/\s+$/, '') + '\n';
  if (last < 0) {
    const d = /^(['"])use (client|server)\1;?[ \t]*\n/.exec(src);
    const at = d ? d[0].length : 0;
    return src.slice(0, at) + (d ? '\n' : '') + out + src.slice(at);
  }
  let head = src.slice(0, last);
  if (!head.endsWith('\n')) head += '\n';
  return head + (blank ? '\n' : '') + out + src.slice(last);
}

// ---------- line ops ----------
function findLine(src, reSrc, last) {
  const re = new RegExp(reSrc, last ? 'gm' : 'm');
  let m = null;
  if (last) { let x; while ((x = re.exec(src))) { m = x; if (x[0].length === 0) re.lastIndex++; } }
  else m = re.exec(src);
  if (!m) return null;
  const p = m.index + /^\s*/.exec(m[0])[0].length;
  const ls = lineStart(src, p);
  let le = src.indexOf('\n', p);
  if (le < 0) le = src.length;
  return { ls, le, indent: leadingWs(src.slice(ls, le)) };
}
function indentText(text, indent) {
  return text.replace(/\s+$/, '').split('\n').map((l) => (l.trim() ? indent + l : l)).join('\n');
}

// ---------- main ----------
function main() {
  if (op === 'write') {
    fs.mkdirSync(path.dirname(fileArg), { recursive: true });
    const existed = fs.existsSync(fileArg);
    fs.writeFileSync(fileArg, stdin());
    ok((existed ? 'replaced ' : 'created  ') + fileArg);
    return;
  }

  const real = resolveFile(fileArg);
  if (!real) return fail(fileArg, 'file not found (edit skipped)', snippetOf());
  let src = fs.readFileSync(real, 'utf8');
  const crlf = src.includes('\r\n');
  if (crlf) src = src.replace(/\r\n/g, '\n');
  const save = (s, msg) => {
    fs.writeFileSync(real, crlf ? s.replace(/\n/g, '\r\n') : s);
    ok(real + ': ' + msg);
  };
  const F = real;

  if (opts.unless && src.includes(opts.unless)) return skip(F + ': already applied (' + op + ')');

  switch (op) {
    case 'append': {
      save(src.replace(/\s*$/, '\n') + stdin().replace(/\s*$/, '\n'), 'appended');
      return;
    }
    case 'replace': {
      const [oldS, newS] = pos;
      const idx = src.indexOf(oldS);
      if (idx < 0) {
        if (src.includes(newS)) return skip(F + ': already applied');
        return fail(F, 'text to replace not found', 'REPLACE:\n' + oldS + '\nWITH:\n' + newS);
      }
      if (src.indexOf(oldS, idx + 1) >= 0) return fail(F, 'text to replace is not unique', 'REPLACE:\n' + oldS + '\nWITH:\n' + newS);
      save(src.slice(0, idx) + newS + src.slice(idx + oldS.length), 'replaced text');
      return;
    }
    case 'replace_re': {
      const re = new RegExp(pos[0], 'm');
      const repl = pos[1].replace(/\\n/g, '\n');
      const m = re.exec(src);
      if (!m) return fail(F, 'pattern not found: ' + pos[0], 'REPLACE WITH:\n' + repl);
      let out = src.replace(re, repl);
      out = dropUnused(out, identsOf(m[0]));
      save(out, 'patched ' + pos[0].slice(0, 50));
      return;
    }
    case 'insert_after_line':
    case 'insert_before_line': {
      const hit = findLine(src, pos[0], !!opts.last);
      let text = stdin().replace(/\s+$/, '');
      if (!hit) return fail(F, 'anchor line not found: ' + pos[0], text);
      if (opts.indent) text = indentText(text, hit.indent);
      if (op === 'insert_after_line') {
        const at = hit.le;
        src = src.slice(0, at) + '\n' + text + src.slice(at);
      } else {
        src = src.slice(0, hit.ls) + text + '\n' + src.slice(hit.ls);
      }
      save(src, op.replace(/_/g, ' ') + ' ' + pos[0].slice(0, 40));
      return;
    }
    case 'add_import': {
      const text = stdin().replace(/\s+$/, '');
      const first = text.split('\n')[0].trim();
      if (src.includes(text) || (!text.includes('\n') && src.includes(first))) return skip(F + ': import already present');
      const pm = new RegExp(IMPORT_SRC, 'm').exec(text + '\n');
      if (pm && pm[3] !== undefined && !pm[2] && !pm[1]) {
        const names = pm[3].split(',').map((s) => s.trim()).filter(Boolean);
        const r = mergeSpecifiers(src, 'import', pm[5], names);
        if (r.found) {
          if (r.changed) save(r.src, 'merged import from ' + pm[5]);
          else skip(F + ': import already present');
          return;
        }
      }
      save(insertAfterImports(src, text, false), 'added import');
      return;
    }
    case 'after_imports': {
      save(insertAfterImports(src, stdin(), true), 'inserted after imports');
      return;
    }
    case 'add_specifiers': {
      const [kind, mod, ...names] = pos;
      const r = mergeSpecifiers(src, kind, mod, names);
      if (!r.found) return fail(F, 'no `' + kind + ' { ... } from "' + mod + '"` statement found', kind + ' { ' + names.join(', ') + ' } from "' + mod + '"');
      if (!r.changed) return skip(F + ': specifiers already present');
      save(r.src, 'added ' + names.join(', '));
      return;
    }
    case 'remove_member': {
      let removedAny = false, idents = [];
      for (const name of pos) {
        const fb = findBlock(src, startRe(name));
        if (!fb) { fail(F, 'could not find `' + name + '` to remove (already gone?)', 'remove: ' + name); continue; }
        idents = idents.concat(identsOf(fb.text));
        src = cutBlock(src, fb);
        removedAny = true;
        console.log('    removed ' + name);
      }
      if (removedAny) save(dropUnused(src, idents), 'removed members');
      return;
    }
    case 'replace_member': {
      const name = pos[0];
      const fb = findBlock(src, startRe(name));
      const text = stdin().replace(/\s+$/, '');
      if (!fb) return fail(F, 'could not find `' + name + '` to replace', text);
      src = src.slice(0, fb.start) + text + '\n' + src.slice(fb.end);
      save(dropUnused(src, identsOf(fb.text)), 'replaced ' + name);
      return;
    }
    case 'patch_member': {
      const [name, regex, repl0] = pos;
      const repl = repl0.replace(/\\n/g, '\n');
      const fb = findBlock(src, startRe(name));
      if (!fb) return fail(F, 'could not find `' + name + '`', 'in ' + name + ': ' + regex + ' -> ' + repl);
      const re = new RegExp(regex, 'm');
      const m = re.exec(fb.text);
      if (!m) {
        if (fb.text.includes(repl)) return skip(F + ': ' + name + ' already patched');
        return fail(F, 'pattern not found inside `' + name + '`: ' + regex, 'in ' + name + ': replace with\n' + repl);
      }
      const nt = fb.text.replace(re, repl);
      src = src.slice(0, fb.start) + nt + src.slice(fb.end);
      save(dropUnused(src, identsOf(m[0])), 'patched ' + name);
      return;
    }
    case 'insert_after_member': {
      const name = pos[0];
      const fb = findBlock(src, startRe(name));
      let text = stdin().replace(/\s+$/, '');
      if (!fb) return fail(F, 'could not find `' + name + '`', text);
      if (opts.indent) text = indentText(text, leadingWs(src.slice(fb.start)));
      src = src.slice(0, fb.end) + text + '\n' + src.slice(fb.end);
      save(src, 'inserted after ' + name);
      return;
    }
    case 'remove_block': {
      const fb = findBlock(src, new RegExp(pos[0], 'm'));
      if (!fb) return fail(F, 'block not found: ' + pos[0], 'remove block matching ' + pos[0]);
      save(dropUnused(cutBlock(src, fb), identsOf(fb.text)), 'removed block');
      return;
    }
    case 'add_to_object': {
      const text = stdin().replace(/\s+$/, '');
      let open = -1;
      for (const r of pos) {
        const m = new RegExp(r, 'm').exec(src);
        if (m && src[m.index + m[0].length - 1] === '{') { open = m.index + m[0].length - 1; break; }
      }
      if (open < 0) return fail(F, 'object literal not found (' + pos.join(' | ') + ')', text);
      const close = matchClose(src, open);
      if (close < 0) return fail(F, 'could not find the end of the object', text);
      let before = src.slice(0, close).replace(/\s*$/, '');
      if (!before.endsWith(',') && !before.endsWith('{')) before += ',';
      const ls = lineStart(src, close);
      const closeIndent = src.slice(ls, close).trim() === '' ? src.slice(ls, close) : '';
      save(before + '\n' + text + '\n' + closeIndent + src.slice(close), 'added members to object');
      return;
    }
    case 'routes9': {
      if (src.includes('"shareResolve"')) return skip(F + ': routes already updated');
      const block = stdin().replace(/\s+$/, '');
      const lines = src.split('\n');
      const idxs = [];
      lines.forEach((l, i) => { if (/\bid:\s*"(shareAnalysis|shareExplain|shareLegacy)"/.test(l)) idxs.push(i); });
      if (!idxs.length) return fail(F, 'shareAnalysis/shareExplain/shareLegacy rows not found', block);
      if (!idxs.every((i) => /^\s*\{.*\},?\s*$/.test(lines[i]))) {
        return fail(F, 'old share rows are not single-line objects; replace them by hand with:', block);
      }
      const indent = leadingWs(lines[idxs[0]]);
      lines[idxs[0]] = indentText(block, indent);
      for (const i of idxs.slice(1).reverse()) lines.splice(i, 1);
      src = lines.join('\n');
      // import
      const newImport = 'import { CreateShareRequestSchema, PublicShareResponseSchema, ShareListQuerySchema, ShareListResponseSchema, ShareSchema } from "./shares";';
      const re = new RegExp(IMPORT_SRC, 'gm');
      let m, replaced = false, common = null;
      while ((m = re.exec(src))) {
        if (m[5] === './shares') { src = src.slice(0, m.index) + newImport + '\n' + src.slice(m.index + m[0].length); replaced = true; break; }
        if (m[5] === './common') common = m;
      }
      if (!replaced) {
        if (common) { const at = common.index + common[0].length; src = src.slice(0, at) + newImport + '\n' + src.slice(at); }
        else src = insertAfterImports(src, newImport, false);
      }
      save(src, 'share routes updated');
      return;
    }
    default:
      return fail(F, 'unknown op ' + op, '');
  }
}

try { main(); } catch (e) { fail(fileArg || '?', 'edit crashed: ' + (e && e.message), STDIN_OPS.has(op) ? stdin() : pos.join(' | ')); }
P9JS

put()  { node "$EDIT" write "$1"; }
edit() { node "$EDIT" "$@" || FAILS=$((FAILS + 1)); }
locate() { # locate <filename> <default path>
  local f
  f="$(find "$WEB" -name "$1" -not -path '*/node_modules/*' -not -path '*/.next/*' 2>/dev/null | head -1)"
  if [ -n "$f" ]; then echo "$f"; else echo "$2"; fi
}

# ===========================================================================
# 2. CONTRACTS (packages/contracts)
# ===========================================================================
echo "==> Contracts"

put "$CON/shares.ts" <<'P9EOF'
import { z } from "zod";
import { IsoDateTimeSchema, listResponse } from "./common";
import { SharedAnalysisResponseSchema } from "./analysis";
import { SharedExplainSessionResponseSchema } from "./explain";
import { VisualizationStructureSchema } from "./visualizations";

export const ShareTypeSchema = z.enum(["analysis", "explain", "visualization"]);
export type ShareType = z.infer<typeof ShareTypeSchema>;

/** 12 base64url characters (randomBytes(9)). */
export const ShareIdSchema = z.string().regex(/^[A-Za-z0-9_-]{12}$/);
export const ShareTargetIdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const CreateShareRequestSchema = z.object({ type: ShareTypeSchema, targetId: ShareTargetIdSchema });
export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;

/** GET /api/shares?target=analysis:<id> */
export const ShareListQuerySchema = z.object({
  target: z
    .string()
    .regex(/^(analysis|explain|visualization):[A-Za-z0-9_-]{1,64}$/)
    .describe("<type>:<targetId>, for example analysis:cm1abc."),
});

export function parseShareTarget(value: string): { type: ShareType; targetId: string } | null {
  const i = value.indexOf(":");
  if (i < 0) return null;
  const type = ShareTypeSchema.safeParse(value.slice(0, i));
  const targetId = ShareTargetIdSchema.safeParse(value.slice(i + 1));
  return type.success && targetId.success ? { type: type.data, targetId: targetId.data } : null;
}

export const ShareSchema = z.object({
  shareId: ShareIdSchema,
  url: z.url(),
  type: ShareTypeSchema,
  targetId: z.string(),
  createdAt: IsoDateTimeSchema,
  revokedAt: IsoDateTimeSchema.nullable(),
  viewCount: z.number().int().min(0),
});
export const ShareListResponseSchema = listResponse(ShareSchema);

/** Public creator card. Deliberately has no user id. */
export const PublicCreatorSchema = z.object({
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const SharedVisualizationResponseSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  script: z.string(),
  structures: z.array(VisualizationStructureSchema),
});

/** { type, data, creator }. createdAt is when the link was created. */
export const PublicShareResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("analysis"), createdAt: IsoDateTimeSchema, data: SharedAnalysisResponseSchema, creator: PublicCreatorSchema.optional() }),
  z.object({ type: z.literal("explain"), createdAt: IsoDateTimeSchema, data: SharedExplainSessionResponseSchema, creator: PublicCreatorSchema.optional() }),
  z.object({ type: z.literal("visualization"), createdAt: IsoDateTimeSchema, data: SharedVisualizationResponseSchema, creator: PublicCreatorSchema.optional() }),
]);

export type Share = z.infer<typeof ShareSchema>;
export type ShareListResponse = z.infer<typeof ShareListResponseSchema>;
export type PublicCreator = z.infer<typeof PublicCreatorSchema>;
export type SharedVisualizationResponse = z.infer<typeof SharedVisualizationResponseSchema>;
export type PublicShareResponse = z.infer<typeof PublicShareResponseSchema>;
P9EOF

edit replace "$CON/registry.ts" \
  'import { CreateShareRequestSchema, PublicShareResponseSchema, ShareSchema } from "./shares";' \
  'import { CreateShareRequestSchema, PublicShareResponseSchema, ShareListResponseSchema, ShareSchema } from "./shares";'
edit replace "$CON/registry.ts" \
  $'\n  Share: ShareSchema,' \
  $'\n  Share: ShareSchema,\n  ShareListResponse: ShareListResponseSchema,'

edit routes9 "$CON/routes.ts" <<'P9EOF'
{ id: "shareResolve", method: "get", path: "/api/share/{shareId}", summary: "Resolve a public share: { type, data, creator }", tag: "Share", auth: "none", csrf: false, rateLimit: "general", params: ShareIdParamsSchema, responses: { 200: PublicShareResponseSchema }, notes: "Revoked, expired and unknown ids are all 404. Sent with Cache-Control: public, no-cache." },
{ id: "shareAnalysis", method: "get", path: "/api/share/analysis/{shareId}", summary: "Public analysis (alias of /api/share/{shareId}, data only)", tag: "Share", auth: "none", csrf: false, rateLimit: "general", params: ShareIdParamsSchema, responses: { 200: SharedAnalysisResponseSchema }, notes: "Deprecated alias." },
{ id: "shareExplain", method: "get", path: "/api/share/explain/{shareId}", summary: "Public chat (alias of /api/share/{shareId}, data only)", tag: "Share", auth: "none", csrf: false, rateLimit: "general", params: ShareIdParamsSchema, responses: { 200: SharedExplainSessionResponseSchema }, notes: "Deprecated alias." },

{ id: "sharesList", method: "get", path: "/api/shares", summary: "Active share of one of my items (?target=<type>:<id>)", tag: "Share", auth: "user", csrf: false, rateLimit: "general", query: ShareListQuerySchema, responses: { 200: ShareListResponseSchema } },
{ id: "sharesCreate", method: "post", path: "/api/shares", summary: "Create a share link (idempotent)", tag: "Share", auth: "user", csrf: true, rateLimit: "general", body: CreateShareRequestSchema, responses: { 200: ShareSchema } },
{ id: "sharesRevoke", method: "delete", path: "/api/shares/{shareId}", summary: "Revoke a share link (idempotent)", tag: "Share", auth: "user", csrf: true, rateLimit: "general", params: ShareIdParamsSchema, responses: { 204: "empty" } },
P9EOF

put "$CON/phase9.test.ts" <<'P9EOF'
import { describe, expect, it } from "vitest";
import { CreateShareRequestSchema, ShareIdSchema, ShareListQuerySchema, PublicShareResponseSchema, parseShareTarget, routes } from "./index";

describe("phase 9 contracts", () => {
  it("accepts only 12-character base64url share ids", () => {
    expect(ShareIdSchema.safeParse("abcDEF012-_x").success).toBe(true);
    expect(ShareIdSchema.safeParse("short").success).toBe(false);
    expect(ShareIdSchema.safeParse("has space!!!").success).toBe(false);
  });
  it("validates create bodies and list targets", () => {
    expect(CreateShareRequestSchema.safeParse({ type: "analysis", targetId: "cm1abc" }).success).toBe(true);
    expect(CreateShareRequestSchema.safeParse({ type: "other", targetId: "x" }).success).toBe(false);
    expect(CreateShareRequestSchema.safeParse({ type: "analysis", targetId: "../x" }).success).toBe(false);
    expect(ShareListQuerySchema.safeParse({ target: "visualization:seed_viz_1" }).success).toBe(true);
    expect(parseShareTarget("explain:abc")).toEqual({ type: "explain", targetId: "abc" });
    expect(parseShareTarget("nope")).toBeNull();
  });
  it("describes a public visualization with a creator", () => {
    const ok = PublicShareResponseSchema.safeParse({
      type: "visualization",
      createdAt: "2026-11-07T00:00:00.000Z",
      data: { title: "t", description: null, script: "[]", structures: [] },
      creator: { name: "Ada", username: "ada", avatarUrl: null },
    });
    expect(ok.success).toBe(true);
  });
  it("documents the unified endpoints and drops the legacy alias", () => {
    const keys = new Set(routes.map((r) => `${r.method} ${r.path}`));
    for (const k of ["get /api/shares", "post /api/shares", "delete /api/shares/{shareId}", "get /api/share/{shareId}"]) expect(keys.has(k)).toBe(true);
    expect(routes.some((r) => r.id === "shareLegacy")).toBe(false);
  });
});
P9EOF

# ===========================================================================
# 3. API: new files
# ===========================================================================
echo
echo "==> API: new files"

put "$API/services/lib/share-cache.ts" <<'P9EOF'
export const publicShareCacheKey = (shareId: string): string => `share:public:${shareId}`;
P9EOF

put "$API/repositories/share.repository.ts" <<'P9EOF'
import { prisma, Prisma, type ShareType } from "@algoforge/db";

const activeWhere = (now: Date): Prisma.ShareWhereInput => ({
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

async function ownsTarget(tx: Prisma.TransactionClient, ownerId: string, type: ShareType, targetId: string): Promise<boolean> {
  switch (type) {
    case "analysis":
      return (await tx.analysis.count({ where: { id: targetId, userId: ownerId } })) > 0;
    case "explain":
      return (await tx.explanationSession.count({ where: { id: targetId, userId: ownerId } })) > 0;
    case "visualization":
      return (await tx.visualization.count({ where: { id: targetId, userId: ownerId } })) > 0;
  }
}

export const shareRepository = {
  /**
   * Idempotent. Null when the owner does not own the target. An active share is returned unchanged;
   * a revoked or expired one is re-opened with the NEW shareId, so an old link never comes back to life.
   */
  createForOwnedTarget(ownerId: string, type: ShareType, targetId: string, shareId: string) {
    return prisma.$transaction(async (tx) => {
      if (!(await ownsTarget(tx, ownerId, type, targetId))) return null;
      const existing = await tx.share.findUnique({ where: { type_targetId: { type, targetId } } });
      const live =
        existing !== null &&
        existing.ownerId === ownerId &&
        existing.revokedAt === null &&
        (existing.expiresAt === null || existing.expiresAt > new Date());
      if (existing && live) return existing;
      if (existing) {
        return tx.share.update({ where: { id: existing.id }, data: { shareId, ownerId, revokedAt: null, expiresAt: null } });
      }
      return tx.share.create({ data: { shareId, type, targetId, ownerId } });
    });
  },

  revokeByOwner(shareId: string, ownerId: string) {
    return prisma.share.updateMany({ where: { shareId, ownerId, revokedAt: null }, data: { revokedAt: new Date() } });
  },

  async existsForOwner(shareId: string, ownerId: string): Promise<boolean> {
    return (await prisma.share.count({ where: { shareId, ownerId } })) > 0;
  },

  findActiveByShareId(shareId: string, now: Date = new Date()) {
    return prisma.share.findFirst({ where: { shareId, ...activeWhere(now) } });
  },

  findActiveByTarget(type: ShareType, targetId: string, now: Date = new Date()) {
    return prisma.share.findFirst({ where: { type, targetId, ...activeWhere(now) } });
  },

  findByOwnerAndTarget(ownerId: string, type: ShareType, targetId: string) {
    return prisma.share.findFirst({ where: { ownerId, type, targetId } });
  },

  listActiveForTarget(ownerId: string, type: ShareType, targetId: string, now: Date = new Date()) {
    return prisma.share.findMany({ where: { ownerId, type, targetId, ...activeWhere(now) }, orderBy: { createdAt: "desc" } });
  },

  findActiveShareIds(ownerId: string, type: ShareType, targetIds: string[], now: Date = new Date()) {
    return prisma.share.findMany({
      where: { ownerId, type, targetId: { in: targetIds }, ...activeWhere(now) },
      select: { targetId: true, shareId: true },
    });
  },

  listShareIdsByOwner(ownerId: string) {
    return prisma.share.findMany({ where: { ownerId }, select: { shareId: true } });
  },

  incrementViewCount(shareId: string, now: Date = new Date()) {
    return prisma.share.updateMany({ where: { shareId, ...activeWhere(now) }, data: { viewCount: { increment: 1 } } });
  },
};
P9EOF

put "$API/services/share.service.ts" <<'P9EOF'
import { randomBytes } from "crypto";
import { Prisma, type ShareType } from "@algoforge/db";
import { env } from "../config/env";
import { shareRepository } from "../repositories/share.repository";
import { AppError } from "../utils/app-error";
import { layeredCache } from "./lib/layered-cache";
import { publicShareCacheKey } from "./lib/share-cache";

const MAX_ATTEMPTS = 5;

/** 12 base64url characters (decision D7). */
export const newShareId = (): string => randomBytes(9).toString("base64url");

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** The legacy flags every list/detail serializer already reads, now derived from the shares table. */
export type WithShareState<T> = Omit<T, "shareId" | "isPublic"> & { shareId: string | null; isPublic: boolean };

class ShareService {
  /** The one place a share URL is built. */
  urlFor(shareId: string): string {
    return `${env.webAppUrl}/s/${shareId}`;
  }

  /** Idempotent. Retries when a freshly generated id collides with an existing one. */
  async create(ownerId: string, type: ShareType, targetId: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        const share = await shareRepository.createForOwnedTarget(ownerId, type, targetId, newShareId());
        if (!share) throw AppError.notFound("Item not found.");
        return share;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (isUniqueViolation(error) && attempt < MAX_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  /** Idempotent: revoking an already revoked link succeeds; someone else's or unknown id is 404. */
  async revoke(ownerId: string, shareId: string): Promise<void> {
    const result = await shareRepository.revokeByOwner(shareId, ownerId);
    if (result.count === 0 && !(await shareRepository.existsForOwner(shareId, ownerId))) {
      throw AppError.notFound("Share not found.");
    }
    await layeredCache.del(publicShareCacheKey(shareId));
  }

  listForTarget(ownerId: string, type: ShareType, targetId: string) {
    return shareRepository.listActiveForTarget(ownerId, type, targetId);
  }

  /** targetId -> active shareId, for the caller's own items only. */
  async activeShareMap(ownerId: string, type: ShareType, targetIds: string[]): Promise<Map<string, string>> {
    if (targetIds.length === 0) return new Map();
    const rows = await shareRepository.findActiveShareIds(ownerId, type, targetIds);
    return new Map(rows.map((r) => [r.targetId, r.shareId]));
  }

  /** Overrides isPublic/shareId on rows with the unified share state. */
  async withShareState<T extends { id: string }>(ownerId: string, type: ShareType, rows: readonly T[]): Promise<WithShareState<T>[]> {
    const map = await this.activeShareMap(ownerId, type, rows.map((r) => r.id));
    return rows.map((row) => {
      const shareId = map.get(row.id) ?? null;
      return { ...row, shareId, isPublic: shareId !== null } as WithShareState<T>;
    });
  }

  /** The active (not revoked, not expired) share, or 404. */
  async resolve(shareId: string) {
    const share = await shareRepository.findActiveByShareId(shareId);
    if (!share) throw AppError.notFound("Share not found.");
    return share;
  }
}

export const shareService = new ShareService();
P9EOF

# (the stray `LIMITS` import and `void LIMITS;` from the write-up are already removed here)
put "$API/services/public-share.service.ts" <<'P9EOF'
import { z } from "zod";
import { ShareIdSchema, VisualizationStructureSchema, type PublicShareResponse, type ShareType } from "@algoforge/contracts";
import { analysisRepository } from "../repositories/analysis.repository";
import { explanationSessionRepository } from "../repositories/explanation-session.repository";
import { shareRepository } from "../repositories/share.repository";
import { visualizationRepository } from "../repositories/visualization.repository";
import { serializeSharedAnalysis } from "../serializers/analysis";
import { toIso } from "../serializers/dates";
import { serializeMessage } from "../serializers/explain";
import { AppError } from "../utils/app-error";
import { logger, serializeError } from "../utils/logger";
import { layeredCache } from "./lib/layered-cache";
import { publicShareCacheKey } from "./lib/share-cache";

const CACHE_TTL_SECONDS = 60;
const NOT_FOUND = "This link is not available.";
const StructuresSchema = z.array(VisualizationStructureSchema);

type ActiveShare = NonNullable<Awaited<ReturnType<typeof shareRepository.findActiveByShareId>>>;
type UserRow = { name: string | null; username: string | null; image: string | null } | null;

const creatorOf = (u: UserRow) => (u ? { name: u.name, username: u.username ?? u.name, avatarUrl: u.image } : null);

/** Only whitelisted fields leave this function: never a user id, never another item. */
async function load(share: ActiveShare): Promise<PublicShareResponse | null> {
  const createdAt = toIso(share.createdAt);
  switch (share.type) {
    case "analysis": {
      const row = await analysisRepository.findPublicById(share.targetId);
      if (!row) return null;
      const creator = creatorOf(row.user);
      return { type: "analysis", createdAt, data: serializeSharedAnalysis({ ...row, user: null }), ...(creator ? { creator } : {}) };
    }
    case "explain": {
      const row = await explanationSessionRepository.findPublicById(share.targetId);
      if (!row) return null;
      const creator = creatorOf(row.user);
      return {
        type: "explain",
        createdAt,
        data: { id: row.id, title: row.title, messages: row.messageRows.map(serializeMessage), createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) },
        ...(creator ? { creator } : {}),
      };
    }
    case "visualization": {
      const row = await visualizationRepository.findPublicById(share.targetId);
      if (!row) return null;
      const structures = StructuresSchema.safeParse(row.structures);
      const creator = creatorOf(row.user);
      return {
        type: "visualization",
        createdAt,
        data: { title: row.title, description: row.description, script: row.script, structures: structures.success ? structures.data : [] },
        ...(creator ? { creator } : {}),
      };
    }
  }
}

class PublicShareService {
  /**
   * Order matters for revocation: the share row is checked on EVERY request, before the cache is read,
   * so a revoked link is gone on every instance at once. The cache only saves the heavy target load.
   */
  async resolve(shareId: string): Promise<PublicShareResponse> {
    if (!ShareIdSchema.safeParse(shareId).success) throw AppError.notFound(NOT_FOUND);
    const share = await shareRepository.findActiveByShareId(shareId);
    if (!share) throw AppError.notFound(NOT_FOUND);

    const key = publicShareCacheKey(shareId);
    let payload = await layeredCache.get<PublicShareResponse>(key);
    if (!payload) {
      payload = await load(share);
      if (!payload) throw AppError.notFound(NOT_FOUND);
      await layeredCache.set(key, payload, CACHE_TTL_SECONDS);
    }

    // Cheap and async: a failed counter must never fail a public read.
    void shareRepository.incrementViewCount(shareId).catch((error: unknown) => {
      logger.warn("share view count failed", { shareId, ...serializeError(error) });
    });
    return payload;
  }

  /** For the deprecated type-specific aliases: the id must belong to that type. */
  async resolveAs(shareId: string, type: ShareType): Promise<PublicShareResponse> {
    const payload = await this.resolve(shareId);
    if (payload.type !== type) throw AppError.notFound(NOT_FOUND);
    return payload;
  }
}

export const publicShareService = new PublicShareService();
P9EOF

put "$API/serializers/share.ts" <<'P9EOF'
import type { Share } from "@algoforge/contracts";
import { toIso } from "./dates";

export interface ShareRow {
  shareId: string;
  type: Share["type"];
  targetId: string;
  createdAt: Date | string;
  revokedAt: Date | string | null;
  viewCount: number;
}

export function serializeShare(row: ShareRow, url: string): Share {
  return {
    shareId: row.shareId,
    url,
    type: row.type,
    targetId: row.targetId,
    createdAt: toIso(row.createdAt),
    revokedAt: row.revokedAt ? toIso(row.revokedAt) : null,
    viewCount: row.viewCount,
  };
}
P9EOF

put "$API/validation/share.ts" <<'P9EOF'
import {
  CreateShareRequestSchema,
  ShareIdSchema,
  ShareListQuerySchema,
  parseShareTarget,
  type CreateShareRequest,
  type ShareType,
} from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { badRequestFromZod } from "./common";

export function parseCreateShare(value: unknown): CreateShareRequest {
  const r = CreateShareRequestSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid share request.");
  return r.data;
}

export function parseShareId(value: unknown): string {
  const r = ShareIdSchema.safeParse(value);
  if (!r.success) throw AppError.badRequest("Invalid share id.");
  return r.data;
}

export function parseShareTargetQuery(value: unknown): { type: ShareType; targetId: string } {
  const r = ShareListQuerySchema.safeParse({ target: typeof value === "string" ? value : undefined });
  if (!r.success) throw badRequestFromZod(r.error, "target must look like <type>:<id>.");
  const target = parseShareTarget(r.data.target);
  if (!target) throw AppError.badRequest("Invalid share target.");
  return target;
}
P9EOF

put "$API/controllers/share.controller.ts" <<'P9EOF'
import { Request, Response } from "express";
import type { ShareListResponse, ShareType } from "@algoforge/contracts";
import { serializeShare } from "../serializers/share";
import { publicShareService } from "../services/public-share.service";
import { shareService } from "../services/share.service";
import { asyncHandler } from "../utils/async-handler";
import { parseCreateShare, parseShareId, parseShareTargetQuery } from "../validation/share";

const present = (row: Parameters<typeof serializeShare>[0]) => serializeShare(row, shareService.urlFor(row.shareId));

/** Owner endpoints: always scoped to req.auth.user.id inside the service and the queries. */
class ShareController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const { type, targetId } = parseShareTargetQuery(req.query.target);
    const rows = await shareService.listForTarget(req.auth!.user.id, type, targetId);
    const body: ShareListResponse = { data: rows.map(present) };
    res.setHeader("Cache-Control", "no-store");
    res.json(body);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateShare(req.body);
    const share = await shareService.create(req.auth!.user.id, input.type, input.targetId);
    res.setHeader("Cache-Control", "no-store");
    res.json(present(share));
  });

  revoke = asyncHandler(async (req: Request, res: Response) => {
    await shareService.revoke(req.auth!.user.id, parseShareId(req.params.shareId));
    res.status(204).send();
  });
}

/** Anonymous endpoints. Never reads req.auth. */
class PublicShareController {
  private headers(res: Response, ok: boolean): void {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    // Revalidate every time: the server answers 304/200 only after re-checking the share is still active.
    res.setHeader("Cache-Control", ok ? "public, no-cache" : "no-store");
  }

  resolve = asyncHandler(async (req: Request, res: Response) => {
    this.headers(res, false); // an error keeps no-store
    const body = await publicShareService.resolve(String(req.params.shareId));
    this.headers(res, true);
    res.json(body);
  });

  private alias(type: ShareType) {
    return asyncHandler(async (req: Request, res: Response) => {
      this.headers(res, false);
      const payload = await publicShareService.resolveAs(String(req.params.shareId), type);
      this.headers(res, true);
      res.json(payload.data);
    });
  }
  resolveAnalysis = this.alias("analysis");
  resolveExplain = this.alias("explain");
}

export const shareController = new ShareController();
export const publicShareController = new PublicShareController();
P9EOF

put "$API/routes/shares.ts" <<'P9EOF'
import { Router } from "express";
import { env } from "../config/env";
import { shareController as c } from "../controllers/share.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();
const limit = generalRateLimiter({ scope: "shares", limitPerMinute: env.redis.shareRateLimitPerMinute });

router.get("/", requireAuth, limit, c.list);
router.post("/", requireAuth, requireCsrf, limit, c.create);
router.delete("/:shareId", requireAuth, requireCsrf, limit, c.revoke);

export default router;
P9EOF

put "$API/routes/share.ts" <<'P9EOF'
import { Router } from "express";
import { env } from "../config/env";
import { publicShareController as c } from "../controllers/share.controller";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();
const limit = generalRateLimiter({ scope: "share-public", limitPerMinute: env.redis.publicShareRateLimitPerMinute });

// Deprecated aliases: same resolver, data only.
router.get("/analysis/:shareId", limit, c.resolveAnalysis);
router.get("/explain/:shareId", limit, c.resolveExplain);
// Unified resolver: { type, data, creator }.
router.get("/:shareId", limit, c.resolve);

export default router;
P9EOF

# ===========================================================================
# 4. API: edits to existing files
# ===========================================================================
echo
echo "==> API: edits to existing files"

# config/env.ts
edit insert_after_line "$API/config/env.ts" 'VISUALIZATION_RATE_LIMIT_PER_MINUTE' --indent --unless=SHARE_RATE_LIMIT_PER_MINUTE <<'P9EOF'
shareRateLimitPerMinute: parseInteger("SHARE_RATE_LIMIT_PER_MINUTE", 30),
publicShareRateLimitPerMinute: parseInteger("PUBLIC_SHARE_RATE_LIMIT_PER_MINUTE", 60),
P9EOF

# app.ts
edit add_import "$API/app.ts" <<< 'import shareManageRouter from "./routes/shares";'
edit replace "$API/app.ts" \
  'app.use("/api/share", shareRouter);' \
  'app.use("/api/shares", shareManageRouter); // owner: create / revoke / list
app.use("/api/share", shareRouter);        // public: resolve'

# utils/capabilities.ts
edit replace "$API/utils/capabilities.ts" 'sharing: input.aiConfigured,' 'sharing: true,'

# repositories/analysis.repository.ts
F="$API/repositories/analysis.repository.ts"
edit remove_member "$F" findForShare setPublic findPublicByShareId
edit add_to_object "$F" 'export const analysisRepository\b[^=\n]*=\s*\{' 'export const \w+Repository\b[^=\n]*=\s*\{' --unless=findPublicById <<'P9EOF'
  /** Public read of one analysis. Only call after an ACTIVE share for this id was verified. */
  findPublicById(id: string) {
    return prisma.analysis.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        language: true,
        result: true,
        createdAt: true,
        user: { select: { name: true, username: true, image: true } },
      },
    });
  },
P9EOF

# repositories/explanation-session.repository.ts
F="$API/repositories/explanation-session.repository.ts"
edit remove_member "$F" share findPublicByShareId
edit add_import "$F" <<< 'import { LIMITS } from "@algoforge/contracts";'
edit add_to_object "$F" 'export const explanationSessionRepository\b[^=\n]*=\s*\{' 'export const \w+Repository\b[^=\n]*=\s*\{' --unless=findPublicById <<'P9EOF'
  /** Public read. Only call after an ACTIVE share for this id was verified. */
  findPublicById(id: string) {
    return prisma.explanationSession.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { name: true, username: true, image: true } },
        messageRows: {
          orderBy: { seq: "asc" },
          take: LIMITS.assistant.maxMessagesPerSession,
          select: { id: true, seq: true, role: true, content: true, intent: true, createdAt: true },
        },
      },
    });
  },
P9EOF

# repositories/visualization.repository.ts
F="$API/repositories/visualization.repository.ts"
edit add_to_object "$F" 'export const visualizationRepository\b[^=\n]*=\s*\{' 'export const \w+Repository\b[^=\n]*=\s*\{' --unless=findPublicById <<'P9EOF'
  /** Public read. Only call after an ACTIVE share for this id was verified. Never selects userId. */
  findPublicById(id: string) {
    return prisma.visualization.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        script: true,
        structures: true,
        user: { select: { name: true, username: true, image: true } },
      },
    });
  },
P9EOF

# repositories/user.repository.ts
F="$API/repositories/user.repository.ts"
edit remove_member "$F" listPublicExplainShareIds
edit add_to_object "$F" 'export const userRepository\b[^=\n]*=\s*\{' 'export const \w+Repository\b[^=\n]*=\s*\{' --unless=listShareIds <<'P9EOF'
  listShareIds(userId: string) {
    return prisma.share.findMany({ where: { ownerId: userId }, select: { shareId: true } });
  },
P9EOF

# services/user.service.ts
F="$API/services/user.service.ts"
edit replace "$F" \
  'import { publicCacheKey } from "./explanation-session.service";' \
  'import { publicShareCacheKey } from "./lib/share-cache";'
edit replace "$F" \
  'const shared = await userRepository.listPublicExplainShareIds(userId);' \
  'const shared = await userRepository.listShareIds(userId);'
edit replace_re "$F" \
  'shared\.flatMap\(\(row\) => \(row\.shareId \? \[layeredCache\.del\(publicCacheKey\(row\.shareId\)\)\] : \[\]\)\)' \
  'shared.map((row) => layeredCache.del(publicShareCacheKey(row.shareId)))'

# services/analysis.service.ts  (legacy share methods delegate to the unified service)
F="$API/services/analysis.service.ts"
edit remove_member "$F" generateShareId getPublicAnalysis
edit replace_member "$F" listUserAnalyses <<'P9EOF'
  async listUserAnalyses(userId: string, query: AnalysisHistoryQuery) {
    const rows = await analysisRepository.findManyByUser(userId, {
      take: query.limit + 1, sort: query.sort,
      cursorCreatedAt: query.cursorCreatedAt, cursorId: query.cursorId, q: query.q, language: query.language,
    });
    const page = paginate(rows, query.limit, (row) =>
      encodeAnalysisCursor({ createdAt: row.createdAt.toISOString(), id: row.id, sort: query.sort }),
    );
    return { ...page, items: await shareService.withShareState(userId, "analysis", page.items) };
  }
P9EOF
edit replace_member "$F" getUserAnalysisById <<'P9EOF'
  async getUserAnalysisById(userId: string, analysisId: string) {
    const analysis = await analysisRepository.findOneByUser(userId, analysisId);
    if (!analysis) throw AppError.notFound("Analysis not found.");
    const [row] = await shareService.withShareState(userId, "analysis", [analysis]);
    return row;
  }
P9EOF
edit replace_member "$F" shareAnalysis <<'P9EOF'
  /** Legacy endpoint kept for old clients: delegates to the unified share service. */
  async shareAnalysis(userId: string, analysisId: string) {
    const share = await shareService.create(userId, "analysis", analysisId);
    return { shareUrl: shareService.urlFor(share.shareId) };
  }
P9EOF
edit add_import "$F" <<< 'import { shareService } from "./share.service";'

# controllers/analysis.controller.ts
edit remove_member "$API/controllers/analysis.controller.ts" getPublicAnalysis

# services/explanation-session.service.ts
F="$API/services/explanation-session.service.ts"
edit remove_member "$F" PUBLIC_CACHE_TTL_SECONDS publicCacheKey newShareId buildShareUrl getPublicSession
edit add_import "$F" <<< 'import { publicShareCacheKey } from "./lib/share-cache";'
edit add_import "$F" <<< 'import { shareService } from "./share.service";'
edit after_imports "$F" --unless='export const publicCacheKey' <<'P9EOF'
/** Kept as an export for existing imports and tests; it is now the unified key. */
export const publicCacheKey = publicShareCacheKey;
P9EOF
# sendMessage: no more cache purge, and the unused `session` variable goes away
edit patch_member "$F" sendMessage \
  'const session = await explanationSessionRepository\.findOwned\(([^)]*)\);\s*\n\s*if \(!session\) throw AppError\.notFound\("Session not found\."\);' \
  'if (!(await explanationSessionRepository.findOwned($1))) throw AppError.notFound("Session not found.");'
edit patch_member "$F" sendMessage '\n[ \t]*if \(session\.shareId\)[^\n]*' ''
edit replace_member "$F" listSessions <<'P9EOF'
  async listSessions(userId: string, query: ListSessionsQuery) {
    const rows = await explanationSessionRepository.findManyByUser(userId, {
      take: query.limit + 1, cursorUpdatedAt: query.cursorUpdatedAt, cursorId: query.cursorId,
    });
    const page = paginate(rows, query.limit, (row) => encodeSessionCursor({ updatedAt: row.updatedAt.toISOString(), id: row.id }));
    return { ...page, items: await shareService.withShareState(userId, "explain", page.items) };
  }
P9EOF
edit replace_member "$F" getSession <<'P9EOF'
  async getSession(userId: string, id: string) {
    const found = await explanationSessionRepository.findOwned(id, userId);
    if (!found) throw AppError.notFound("Session not found.");
    const [session] = await shareService.withShareState(userId, "explain", [found]);
    const rows = await explanationMessageRepository.listBySession(id, userId, { take: LIMITS.assistant.maxMessagesPerSession });
    return { session, messages: rows.map(toMessageRow) };
  }
P9EOF
edit replace_member "$F" renameSession <<'P9EOF'
  async renameSession(userId: string, id: string, title: string) {
    const result = await explanationSessionRepository.rename(id, userId, title);
    if (result.count === 0) throw AppError.notFound("Session not found.");
    const found = await explanationSessionRepository.findOwned(id, userId);
    if (!found) throw AppError.notFound("Session not found.");
    const [session] = await shareService.withShareState(userId, "explain", [found]);
    return session;
  }
P9EOF
edit replace_member "$F" deleteSession <<'P9EOF'
  async deleteSession(userId: string, id: string): Promise<void> {
    const session = await explanationSessionRepository.findOwned(id, userId);
    if (!session) throw AppError.notFound("Session not found.");
    const shareId = (await shareService.activeShareMap(userId, "explain", [id])).get(id);
    const result = await explanationSessionRepository.delete(id, userId); // also deletes the shares row
    if (result.count === 0) throw AppError.notFound("Session not found.");
    if (shareId) await layeredCache.del(publicShareCacheKey(shareId));
  }
P9EOF
edit replace_member "$F" shareSession <<'P9EOF'
  async shareSession(userId: string, id: string) {
    const share = await shareService.create(userId, "explain", id);
    return { shareUrl: shareService.urlFor(share.shareId) };
  }
P9EOF

# controllers/explanation-session.controller.ts
edit remove_member "$API/controllers/explanation-session.controller.ts" getPublic

# ---------- existing API tests ----------
cat > "$WORK/share-mock.txt" <<'P9EOF'
vi.mock("./share.service", () => ({
  shareService: {
    create: vi.fn(),
    activeShareMap: vi.fn(async () => new Map<string, string>()),
    withShareState: vi.fn(async (_u: string, _t: string, rows: unknown[]) => rows),
    urlFor: (id: string) => `http://web.test/s/${id}`,
  },
}));
P9EOF
edit after_imports "$API/services/analysis.service.test.ts" --unless='vi.mock("./share.service"' < "$WORK/share-mock.txt"
T="$API/services/explanation-session.service.test.ts"
edit after_imports "$T" --unless='vi.mock("./share.service"' < "$WORK/share-mock.txt"
edit add_import "$T" <<< 'import { shareService } from "./share.service";'
edit remove_block "$T" '^[ \t]*it\(\s*"purges the public cache of a shared chat"'
edit replace_re "$T" \
  '^([ \t]*)vi\.mocked\(repo\.findOwned\)\.mockResolvedValue\(\{ id: "s1", shareId: "abc123" \} as never\);' \
  '$1vi.mocked(repo.findOwned).mockResolvedValue({ id: "s1" } as never);\n$1vi.mocked(shareService.activeShareMap).mockResolvedValue(new Map([["s1", "abc123"]]));'

# ===========================================================================
# 5. API: new tests
# ===========================================================================
echo
echo "==> API: new tests"

put "$API/services/share.service.test.ts" <<'P9EOF'
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env", () => ({ env: { webAppUrl: "http://web.test" } }));
vi.mock("@algoforge/db", () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error { code = "P2002"; } },
}));
vi.mock("./lib/layered-cache", () => ({ layeredCache: { del: vi.fn(), get: vi.fn(), set: vi.fn() } }));
vi.mock("../repositories/share.repository", () => ({
  shareRepository: {
    createForOwnedTarget: vi.fn(), revokeByOwner: vi.fn(), existsForOwner: vi.fn(),
    listActiveForTarget: vi.fn(), findActiveShareIds: vi.fn(), findActiveByShareId: vi.fn(),
  },
}));

import { Prisma } from "@algoforge/db";
import { shareRepository as repo } from "../repositories/share.repository";
import { layeredCache } from "./lib/layered-cache";
import { publicShareCacheKey } from "./lib/share-cache";
import { shareService } from "./share.service";

beforeEach(() => vi.clearAllMocks());

describe("shareService", () => {
  it("builds /s/<id> urls", () => expect(shareService.urlFor("abc123abc123")).toBe("http://web.test/s/abc123abc123"));

  it("creates with a 12-character base64url id, scoped to the owner", async () => {
    vi.mocked(repo.createForOwnedTarget).mockResolvedValue({ shareId: "x" } as never);
    await shareService.create("u1", "analysis", "a1");
    const [owner, type, target, id] = vi.mocked(repo.createForOwnedTarget).mock.calls[0];
    expect([owner, type, target]).toEqual(["u1", "analysis", "a1"]);
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it("is a 404 when the caller does not own the target", async () => {
    vi.mocked(repo.createForOwnedTarget).mockResolvedValue(null);
    await expect(shareService.create("u2", "visualization", "v1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("retries an id collision", async () => {
    vi.mocked(repo.createForOwnedTarget).mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError()).mockResolvedValueOnce({ shareId: "ok" } as never);
    await expect(shareService.create("u1", "explain", "s1")).resolves.toMatchObject({ shareId: "ok" });
    expect(repo.createForOwnedTarget).toHaveBeenCalledTimes(2);
  });

  it("revokes, purges the cache, and is idempotent", async () => {
    vi.mocked(repo.revokeByOwner).mockResolvedValue({ count: 1 } as never);
    await shareService.revoke("u1", "abc123abc123");
    expect(layeredCache.del).toHaveBeenCalledWith(publicShareCacheKey("abc123abc123"));

    vi.mocked(repo.revokeByOwner).mockResolvedValue({ count: 0 } as never);
    vi.mocked(repo.existsForOwner).mockResolvedValue(true);
    await expect(shareService.revoke("u1", "abc123abc123")).resolves.toBeUndefined();

    vi.mocked(repo.existsForOwner).mockResolvedValue(false);
    await expect(shareService.revoke("u2", "abc123abc123")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("derives isPublic/shareId from the shares table", async () => {
    vi.mocked(repo.findActiveShareIds).mockResolvedValue([{ targetId: "a1", shareId: "sid" }] as never);
    const rows = await shareService.withShareState("u1", "analysis", [{ id: "a1", isPublic: false, shareId: null }, { id: "a2", isPublic: true, shareId: "legacy" }]);
    expect(rows).toEqual([{ id: "a1", isPublic: true, shareId: "sid" }, { id: "a2", isPublic: false, shareId: null }]);
  });
});
P9EOF

put "$API/services/public-share.service.test.ts" <<'P9EOF'
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/share.repository", () => ({ shareRepository: { findActiveByShareId: vi.fn(), incrementViewCount: vi.fn().mockResolvedValue({ count: 1 }) } }));
vi.mock("../repositories/analysis.repository", () => ({ analysisRepository: { findPublicById: vi.fn() } }));
vi.mock("../repositories/explanation-session.repository", () => ({ explanationSessionRepository: { findPublicById: vi.fn() } }));
vi.mock("../repositories/visualization.repository", () => ({ visualizationRepository: { findPublicById: vi.fn() } }));
vi.mock("./lib/layered-cache", () => ({ layeredCache: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

import { ANALYSIS_RESULT_SCHEMA_VERSION } from "@algoforge/contracts";
import { analysisRepository } from "../repositories/analysis.repository";
import { shareRepository } from "../repositories/share.repository";
import { visualizationRepository } from "../repositories/visualization.repository";
import { layeredCache } from "./lib/layered-cache";
import { publicShareService } from "./public-share.service";

const ID = "abc123abc123";
const share = (type: string, targetId = "t1") => ({ shareId: ID, type, targetId, createdAt: new Date("2026-11-07T00:00:00.000Z") });
const result = {
  summary: "s", complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
  breakdown: { approach: "a", steps: ["x"] }, bottlenecks: [], antiPatterns: [], improvements: [], optimizedCode: "x", edgeCases: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(layeredCache.get).mockResolvedValue(null);
});

describe("publicShareService", () => {
  it("answers 404 for a malformed id without touching the database", async () => {
    await expect(publicShareService.resolve("short")).rejects.toMatchObject({ statusCode: 404 });
    expect(shareRepository.findActiveByShareId).not.toHaveBeenCalled();
  });

  it("answers 404 for a revoked share before it even looks at the cache", async () => {
    vi.mocked(shareRepository.findActiveByShareId).mockResolvedValue(null);
    await expect(publicShareService.resolve(ID)).rejects.toMatchObject({ statusCode: 404 });
    expect(layeredCache.get).not.toHaveBeenCalled();
  });

  it("returns { type, data, creator } without any user id, and caches the payload", async () => {
    vi.mocked(shareRepository.findActiveByShareId).mockResolvedValue(share("analysis") as never);
    vi.mocked(analysisRepository.findPublicById).mockResolvedValue({
      id: "t1", code: "x", language: "javascript", createdAt: new Date(),
      result: { schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION, data: result },
      user: { name: "Ada", username: null, image: null },
    } as never);
    const out = await publicShareService.resolve(ID);
    expect(out.type).toBe("analysis");
    expect(out.creator).toEqual({ name: "Ada", username: "Ada", avatarUrl: null });
    expect(JSON.stringify(out)).not.toMatch(/userId/);
    expect("creator" in (out.data as object)).toBe(false);
    expect(layeredCache.set).toHaveBeenCalledWith(expect.stringContaining(ID), out, 60);
    expect(shareRepository.incrementViewCount).toHaveBeenCalledWith(ID);
  });

  it("serves a cache hit but still verified the share first", async () => {
    vi.mocked(shareRepository.findActiveByShareId).mockResolvedValue(share("visualization") as never);
    vi.mocked(layeredCache.get).mockResolvedValue({ type: "visualization", createdAt: "x", data: {} } as never);
    await publicShareService.resolve(ID);
    expect(visualizationRepository.findPublicById).not.toHaveBeenCalled();
    expect(shareRepository.findActiveByShareId).toHaveBeenCalled();
  });

  it("degrades unreadable stored structures and 404s a missing target", async () => {
    vi.mocked(shareRepository.findActiveByShareId).mockResolvedValue(share("visualization") as never);
    vi.mocked(visualizationRepository.findPublicById).mockResolvedValue({ title: "t", description: null, script: "[]", structures: "junk", user: null } as never);
    const out = await publicShareService.resolve(ID);
    expect(out.type === "visualization" && out.data.structures).toEqual([]);
    expect(out.creator).toBeUndefined();

    vi.mocked(visualizationRepository.findPublicById).mockResolvedValue(null as never);
    await expect(publicShareService.resolve(ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("aliases refuse an id of another type", async () => {
    vi.mocked(shareRepository.findActiveByShareId).mockResolvedValue(share("visualization") as never);
    vi.mocked(visualizationRepository.findPublicById).mockResolvedValue({ title: "t", description: null, script: "[]", structures: [], user: null } as never);
    await expect(publicShareService.resolveAs(ID, "analysis")).rejects.toMatchObject({ statusCode: 404 });
  });
});
P9EOF

# ===========================================================================
# 6. FRONTEND
# ===========================================================================
echo
echo "==> Web: API client, query keys, hooks"

# 6.1 endpoints
F="$WEB/lib/api/endpoints.ts"
edit add_specifiers "$F" import "@algoforge/contracts" \
  PublicShareResponseSchema ShareListResponseSchema ShareSchema \
  "type CreateShareRequest" "type PublicShareResponse" "type Share" "type ShareListResponse"
edit add_to_object "$F" 'export const endpoints\b[^=\n]*=\s*\{' '\bendpoints\b[^=\n]*=\s*\{' 'return\s*\{' --unless=revokeShare <<'P9EOF'
    shares: (target: { type: string; targetId: string }, signal?: AbortSignal): Promise<ShareListResponse> =>
      client.get("/api/shares", ShareListResponseSchema, { query: { target: `${target.type}:${target.targetId}` }, ...opt(signal) }),
    createShare: (body: CreateShareRequest): Promise<Share> => client.post("/api/shares", ShareSchema, body),
    revokeShare: (shareId: string): Promise<void> => client.delete(`/api/shares/${seg(shareId)}`),
    publicShare: (shareId: string, signal?: AbortSignal): Promise<PublicShareResponse> =>
      client.get(`/api/share/${seg(shareId)}`, PublicShareResponseSchema, opt(signal)),
P9EOF

# keys
edit add_to_object "$WEB/lib/query/keys.ts" 'export const queryKeys\b[^=\n]*=\s*\{' --unless=publicShare <<'P9EOF'
  shares: (type: string, targetId: string) => ["shares", type, targetId] as const,
  publicShare: (shareId: string) => ["share", "public", shareId] as const,
P9EOF

# hooks
F="$WEB/lib/query/hooks.ts"
edit add_import "$F" <<< 'import type { ShareTarget } from "../share/target";'
edit append "$F" --unless=useTargetShares <<'P9EOF'
/** The active share of one of my items. Disabled until there is a target. */
export function useTargetShares(target: ShareTarget | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.shares(target?.type ?? "", target?.id ?? ""),
    queryFn: ({ signal }) => endpoints.shares({ type: target!.type, targetId: target!.id }, signal),
    enabled: enabled && target !== null,
    retry: false,
  });
}

/** Anonymous. A 404 (revoked, unknown) is final, so no retry. */
export function usePublicShare(shareId: string) {
  return useQuery({
    queryKey: queryKeys.publicShare(shareId),
    queryFn: ({ signal }) => endpoints.publicShare(shareId, signal),
    enabled: shareId !== "",
    retry: false,
    staleTime: 0,
  });
}
P9EOF

# query/index.ts
edit add_specifiers "$WEB/lib/query/index.ts" export "./hooks" useTargetShares usePublicShare

# AuthProvider.clearPrivateData
edit replace_re "$(locate AuthProvider.tsx "$WEB/lib/auth/AuthProvider.tsx")" \
  '^([ \t]*)queryClient\.removeQueries\(\{ queryKey: \["[A-Za-z-]+"\] \}\);[ \t]*$' \
  '$&\n$1queryClient.removeQueries({ queryKey: ["shares"] });'

# 6.2 share target
echo
echo "==> Web: share target + workspace store"

put "$WEB/lib/share/target.ts" <<'P9EOF'
import type { ShareType } from "@algoforge/contracts";

export interface ShareTarget {
  type: ShareType;
  id: string;
  title: string;
}
export type ShareFeature = "analysis" | "visualizer" | "history";

export interface WorkspaceShareState {
  run: { status: string; analysisId: string | null; title: string | null };
  selectedAnalysisId: string | null;
  savedVisualization: { id: string; title: string } | null;
}

/** What "Share" means on the active dashboard tab. Null = there is nothing saved to share yet. */
export function targetForFeature(feature: ShareFeature, ws: WorkspaceShareState): ShareTarget | null {
  switch (feature) {
    case "analysis":
      return ws.run.status === "completed" && ws.run.analysisId ? { type: "analysis", id: ws.run.analysisId, title: ws.run.title ?? "Analysis" } : null;
    case "history":
      return ws.selectedAnalysisId ? { type: "analysis", id: ws.selectedAnalysisId, title: "Analysis" } : null;
    case "visualizer":
      return ws.savedVisualization ? { type: "visualization", id: ws.savedVisualization.id, title: ws.savedVisualization.title } : null;
  }
}

export function shareHintFor(feature: ShareFeature): string {
  switch (feature) {
    case "analysis":
      return "Run an analysis first: only saved results can be shared.";
    case "history":
      return "Select an analysis in the list, then press Share.";
    case "visualizer":
      return "Save this visualization to your account first (Script, then Save to account), then share it.";
  }
}
P9EOF

put "$WEB/lib/share/target.test.ts" <<'P9EOF'
import { describe, expect, it } from "vitest";
import { targetForFeature, type WorkspaceShareState } from "./target";

const ws = (over: Partial<WorkspaceShareState> = {}): WorkspaceShareState => ({
  run: { status: "idle", analysisId: null, title: null }, selectedAnalysisId: null, savedVisualization: null, ...over,
});

describe("targetForFeature", () => {
  it("shares the completed analysis on the analysis tab", () => {
    expect(targetForFeature("analysis", ws({ run: { status: "completed", analysisId: "a1", title: "T" } }))).toEqual({ type: "analysis", id: "a1", title: "T" });
    expect(targetForFeature("analysis", ws({ run: { status: "running", analysisId: null, title: null } }))).toBeNull();
  });
  it("shares the selected history row and the saved visualization", () => {
    expect(targetForFeature("history", ws({ selectedAnalysisId: "a2" }))?.id).toBe("a2");
    expect(targetForFeature("visualizer", ws({ savedVisualization: { id: "v1", title: "V" } }))).toEqual({ type: "visualization", id: "v1", title: "V" });
    expect(targetForFeature("visualizer", ws())).toBeNull();
  });
});
P9EOF

# 6.3 workspace store
ST="$WEB/lib/workspace/store.ts"
edit insert_after_line "$ST" '^\s*lastOpenedId: string \| null;\s*$' --indent --unless='selectedAnalysisId: string | null;' <<'P9EOF'
/** The history row the person selected (what Share targets on the History tab). */
selectedAnalysisId: string | null;
/** The saved visualization the editor is bound to (what Share targets on the Visualizer tab). */
savedVisualization: { id: string; title: string } | null;
P9EOF
edit insert_after_line "$ST" '^\s*forgetAnalysis:.*;\s*$' --indent --unless='selectAnalysis: (id: string | null) => void;' <<'P9EOF'
selectAnalysis: (id: string | null) => void;
setSavedVisualization: (v: { id: string; title: string } | null) => void;
P9EOF
edit insert_after_line "$ST" '^\s*lastOpenedId: null as string \| null,\s*$' --indent --unless='selectedAnalysisId: null as' <<'P9EOF'
selectedAnalysisId: null as string | null,
savedVisualization: null as { id: string; title: string } | null,
P9EOF
edit insert_before_line "$ST" '^\s*forgetAnalysis:\s*\([^)]*\)\s*=>\s*$' --indent --unless='selectAnalysis: (id) =>' <<'P9EOF'
selectAnalysis: (id) => set({ selectedAnalysisId: id }),
setSavedVisualization: (v) => set({ savedVisualization: v }),
P9EOF
edit insert_after_line "$ST" 'if \(s\.lastOpenedId === id\) patch\.lastOpenedId = null;' --indent --unless='s.selectedAnalysisId === id' <<'P9EOF'
if (s.selectedAnalysisId === id) patch.selectedAnalysisId = null;
P9EOF

# AnalysisHistoryFeature
F="$(locate AnalysisHistoryFeature.tsx "$WEB/components/DashBoard/AnalysisHistoryFeature.tsx")"
edit insert_after_line "$F" '^\s*meta=\{meta\}\s*$' --indent --unless='selectAnalysis(' <<'P9EOF'
onSelect={(item) => useWorkspace.getState().selectAnalysis(item?.id ?? null)}
P9EOF
edit add_import "$F" <<< 'import { useWorkspace } from "@/lib/workspace/store";'

# SavedWork
F="$(locate SavedWork.tsx "$WEB/components/visualizers/ui/SavedWork.tsx")"
edit replace_re "$F" \
  '^([ \t]*)const \[current, setCurrent\] = useState<Current \| null>\(null\);' \
  '$1const current = useWorkspace((s) => s.savedVisualization);\n$1const setCurrent = useWorkspace((s) => s.setSavedVisualization);'
edit remove_member "$F" Current
edit add_import "$F" <<< 'import { useWorkspace } from "@/lib/workspace/store";'

# algorithms/[slug]/page.tsx
F="$WEB_APP/algorithms/[slug]/page.tsx"
edit insert_after_line "$F" 'saveScript\(a\.script\);' --indent --unless='setSavedVisualization(null)' <<'P9EOF'
useWorkspace.getState().setSavedVisualization(null);
P9EOF
edit add_import "$F" <<< 'import { useWorkspace } from "@/lib/workspace/store";'

# 6.4 ShareModal (full replacement)
echo
echo "==> Web: ShareModal, dashboard wiring, public viewer"

SM="$(locate ShareModal.tsx "$WEB/components/DashBoard/ShareModal.tsx")"
put "$SM" <<'P9EOF'
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import { Check, Copy, ExternalLink, Globe, Link2, Lock, LogIn, Share2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Share } from "@algoforge/contracts";
import { endpoints } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { useAuth, useFeatureState } from "@/lib/auth";
import { useTargetShares } from "@/lib/query";
import { queryKeys } from "@/lib/query/keys";
import type { ShareTarget } from "@/lib/share/target";

interface ShareModalProps {
    isOpen: boolean;
    onClose: VoidFunction;
    /** What is being shared. Null = nothing saved yet (the hint explains what to do). */
    target: ShareTarget | null;
    emptyHint?: string;
}

const TITLES = { analysis: "Share analysis", explain: "Share chat", visualization: "Share visualization" } as const;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } };
const rise: Variants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } };
const noopSubscribe = () => () => {};

async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }
}

const SECONDARY =
    "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary-foreground/10! bg-primary-foreground/3 py-2.5 text-[12px] font-medium text-primary-foreground/70 transition hover:bg-primary-foreground/8 hover:text-primary-foreground";

function Notice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
    return (
        <motion.div variants={rise} className="px-5 pb-5">
            <div role="status" className="rounded-xl border border-primary-foreground/8! bg-primary-foreground/3 p-4 text-[13px] leading-relaxed">
                <p className="font-medium text-primary-foreground">{title}</p>
                <p className="mt-1 text-primary-foreground/60">{body}</p>
            </div>
            <div className="mt-4 flex justify-end">{children}</div>
        </motion.div>
    );
}

export default function ShareModal({ isOpen, onClose, target, emptyHint }: ShareModalProps) {
    const { openLoginModal } = useAuth();
    const feature = useFeatureState("sharing", { uiReady: true });
    const queryClient = useQueryClient();
    const shares = useTargetShares(target, isOpen && feature === "ready");
    const active: Share | null = shares.data?.data[0] ?? null;

    const [copied, setCopied] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const canNativeShare = useSyncExternalStore(noopSubscribe, () => typeof navigator !== "undefined" && !!navigator.share, () => false);

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    /** One place that keeps every view of "is this shared?" in step with the server. */
    const sync = (next: Share[]) => {
        if (target) queryClient.setQueryData(queryKeys.shares(target.type, target.id), { data: next });
        void queryClient.invalidateQueries({ queryKey: ["analysis"] });
        void queryClient.invalidateQueries({ queryKey: ["explain", "sessions"] });
    };

    const create = useMutation({
        mutationFn: () => endpoints.createShare({ type: target!.type, targetId: target!.id }),
        onSuccess: (share) => { setError(null); sync([share]); },
        onError: (e: unknown) => setError(errorMessage(e)),
    });
    const revoke = useMutation({
        mutationFn: (shareId: string) => endpoints.revokeShare(shareId),
        onSuccess: () => { setError(null); sync([]); },
        onError: (e: unknown) => setError(errorMessage(e)),
    });
    const busy = create.isPending || revoke.isPending;
    const link = active?.url ?? null;

    const handleCopy = useCallback(async () => {
        if (!link) return;
        const ok = await copyText(link);
        setCopied(ok);
        setCopyFailed(!ok);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { setCopied(false); setCopyFailed(false); }, 2000);
    }, [link]);

    const handleNativeShare = async () => {
        if (!link || !target) return;
        try {
            await navigator.share({ title: target.title, url: link });
        } catch {
            /* cancelled */
        }
    };

    const handleSignIn = () => {
        onClose();
        openLoginModal({ message: "Sign in to share your work with a link." });
    };

    const title = target ? TITLES[target.type] : "Share";
    const subtitle =
        feature === "needs-account" ? "Sign in to share" : feature !== "ready" ? "Not available" : !target ? "Nothing to share yet" : active ? "Anyone with the link can view" : "Link sharing is turned off";

    let body: ReactNode;
    if (feature === "needs-account") {
        body = (
            <Notice title="Sharing needs an account" body="Links belong to the person who made them, so you need to sign in first. The editor and the visualizer keep working without an account.">
                <button type="button" onClick={handleSignIn} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary-foreground px-3 py-1.5 text-[12px] font-medium text-primary-background transition hover:opacity-90">
                    <LogIn size={13} aria-hidden /> Sign in with Google
                </button>
            </Notice>
        );
    } else if (feature !== "ready") {
        body = (
            <Notice title={feature === "loading" ? "Checking availability…" : "Sharing isn't available on this server"} body="Nothing was shared and no link exists.">
                <Dialog.Close className="cursor-pointer rounded-lg border border-primary-foreground/10! px-3 py-1.5 text-[12px] text-primary-foreground/70 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">Got it</Dialog.Close>
            </Notice>
        );
    } else if (!target) {
        body = (
            <Notice title="Nothing to share yet" body={emptyHint ?? "Save your work first, then share it."}>
                <Dialog.Close className="cursor-pointer rounded-lg border border-primary-foreground/10! px-3 py-1.5 text-[12px] text-primary-foreground/70 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">Got it</Dialog.Close>
            </Notice>
        );
    } else {
        body = (
            <div className="space-y-4 px-5 pb-5">
                <motion.div variants={rise} className="flex items-center justify-between gap-4 rounded-xl border border-primary-foreground/8! bg-primary-foreground/3 p-3.5">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? "bg-emerald-400/10 text-emerald-400" : "bg-primary-foreground/6 text-primary-foreground/60"}`}>
                            {active ? <Globe size={16} strokeWidth={1.75} aria-hidden /> : <Lock size={16} strokeWidth={1.75} aria-hidden />}
                        </div>
                        <div>
                            <p className="text-[13px] font-medium text-primary-foreground">Public link</p>
                            <p className="mt-0.5 text-[12px] text-primary-foreground/60">{active ? "Turn off to revoke it immediately" : "Turn on to create a link"}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={!!active}
                        aria-label="Public link"
                        disabled={busy || shares.isPending}
                        onClick={() => (active ? revoke.mutate(active.shareId) : create.mutate())}
                        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:cursor-wait disabled:opacity-60 ${active ? "bg-emerald-400" : "bg-primary-foreground/25"}`}
                    >
                        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: active ? "22px" : "2px" }} />
                    </button>
                </motion.div>

                {shares.isError && <p role="alert" className="text-[12px] text-red-300">{errorMessage(shares.error)}</p>}
                {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}

                {link && (
                    <>
                        <motion.div variants={rise} className="space-y-2">
                            <div className="flex items-center gap-2 rounded-xl border border-primary-foreground/10! bg-primary-foreground/3 p-1.5 pl-3 transition focus-within:border-accent/50!">
                                <Link2 size={14} className="shrink-0 text-primary-foreground/60" aria-hidden />
                                <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className="min-w-0 flex-1 truncate bg-transparent font-mono text-[12px] text-primary-foreground/80 outline-none" />
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition ${copied ? "bg-emerald-400/15 text-emerald-300" : copyFailed ? "bg-red-400/15 text-red-300" : "bg-primary-foreground text-primary-background hover:opacity-90"}`}
                                >
                                    {copied ? (<><Check size={13} aria-hidden /> Copied</>) : copyFailed ? "Failed" : (<><Copy size={13} aria-hidden /> Copy</>)}
                                </button>
                            </div>
                            <span role="status" className="sr-only">{copied ? "Link copied" : copyFailed ? "Copy failed" : ""}</span>
                            <p className="px-1 text-[11px] text-primary-foreground/60">{active!.viewCount} {active!.viewCount === 1 ? "view" : "views"}</p>
                        </motion.div>
                        <motion.div variants={rise} className="flex gap-2">
                            <a href={link} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
                                <ExternalLink size={13} aria-hidden /> Open
                            </a>
                            {canNativeShare && (
                                <button type="button" onClick={handleNativeShare} className={SECONDARY}>
                                    <Share2 size={13} aria-hidden /> Share…
                                </button>
                            )}
                        </motion.div>
                    </>
                )}
            </div>
        );
    }

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
                <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
                    <Dialog.Popup className="pointer-events-auto relative w-full max-w-120 overflow-hidden rounded-2xl border border-primary-foreground/10! bg-primary-background shadow-2xl outline-none transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-accent/10 to-transparent" />
                        <motion.div variants={list} initial="hidden" animate="show" className="relative">
                            <motion.div variants={rise} className="flex items-center justify-between px-5 pb-4 pt-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary-foreground/10! bg-primary-foreground/5">
                                        <Share2 size={16} className="text-primary-foreground/80" strokeWidth={1.75} aria-hidden />
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <Dialog.Title className="text-[15px] font-semibold tracking-tight text-primary-foreground">{title}</Dialog.Title>
                                        <Dialog.Description className="text-[12px] text-primary-foreground/60">{subtitle}</Dialog.Description>
                                    </div>
                                </div>
                                <Dialog.Close aria-label="Close" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-primary-foreground/60 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">
                                    <X size={15} aria-hidden />
                                </Dialog.Close>
                            </motion.div>
                            {body}
                        </motion.div>
                    </Dialog.Popup>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
P9EOF

# 6.5 Dashboard wiring
DB="$(locate DashBoard.tsx "$WEB/components/DashBoard/DashBoard.tsx")"
edit add_import "$DB" <<< 'import { shareHintFor, targetForFeature } from "@/lib/share/target";'
edit add_import "$DB" <<< 'import { useWorkspace } from "@/lib/workspace/store";'
edit insert_after_line "$DB" 'const containerRef = useRef' --indent --unless='const shareTarget' <<'P9EOF'
const run = useWorkspace((s) => s.run);
const selectedAnalysisId = useWorkspace((s) => s.selectedAnalysisId);
const savedVisualization = useWorkspace((s) => s.savedVisualization);
// What "Share" means depends on the tab. Without a saved item there is nothing to share.
const shareTarget = targetForFeature(activeFeature, { run, selectedAnalysisId, savedVisualization });
P9EOF
edit replace_re "$DB" \
  '<ShareModal\s+isOpen=\{isShareOpen\}\s+onClose=(\{[^}]*\})\s*/>' \
  '<ShareModal isOpen={isShareOpen} onClose=$1 target={shareTarget} emptyHint={shareHintFor(activeFeature)} />'

# 6.6 Public viewer
NEXTCFG="$(ls "$WEB_ROOT"/next.config.ts "$WEB_ROOT"/next.config.mjs "$WEB_ROOT"/next.config.js 2>/dev/null | head -1)"
if [ -n "$NEXTCFG" ]; then
  edit insert_after_member "$NEXTCFG" rewrites --indent --unless='redirects()' <<'P9EOF'
async redirects() {
  return [
    { source: "/share/analysis/:id", destination: "/s/:id", permanent: false },
    { source: "/share/explain/:id", destination: "/s/:id", permanent: false },
  ];
},
P9EOF
else
  echo "  ✗ next.config.* not found; add the /share/* -> /s/:id redirects by hand" | tee -a "$P9_MANUAL"
fi

put "$WEB_APP/s/[shareId]/layout.tsx" <<'P9EOF'
import type { Metadata } from "next";
import type { ReactNode } from "react";

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const ID_RE = /^[A-Za-z0-9_-]{12}$/;
const KIND = { analysis: "Code analysis", explain: "AI chat", visualization: "Visualization" } as const;

type Lite = { type?: keyof typeof KIND; data?: { title?: string | null }; creator?: { name?: string | null } };

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
    const { shareId } = await params;
    const base: Metadata = { title: "Shared on AlgoForge", robots: { index: false, follow: false } };
    if (!ID_RE.test(shareId)) return base;
    try {
        const res = await fetch(`${API_URL}/api/share/${shareId}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
        if (!res.ok) return base;
        const j = (await res.json()) as Lite;
        const kind = j.type ? KIND[j.type] : "Shared item";
        const title = j.data?.title ? `${j.data.title} · AlgoForge` : `${kind} · AlgoForge`;
        const description = `${kind}${j.creator?.name ? ` by ${j.creator.name}` : ""}, shared on AlgoForge.`;
        return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, type: "article" }, twitter: { card: "summary", title, description } };
    } catch {
        return base;
    }
}

export default function ShareLayout({ children }: { children: ReactNode }) {
    return children;
}
P9EOF

put "$WEB_APP/s/[shareId]/page.tsx" <<'P9EOF'
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageShell } from "@/components/site/PageShell";
import { SharedView } from "@/components/share/SharedView";
import { btn } from "@/components/visualizers/shared/styles";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { usePublicShare } from "@/lib/query";

export default function PublicSharePage() {
    const params = useParams<{ shareId: string }>();
    const shareId = typeof params.shareId === "string" ? params.shareId : "";
    const query = usePublicShare(shareId);

    if (query.isPending) {
        return (
            <PageShell wide>
                <p role="status" aria-busy className="text-foreground/60">Loading shared item…</p>
            </PageShell>
        );
    }
    if (query.isError) {
        const gone = isApiError(query.error) && query.error.status === 404;
        return (
            <PageShell>
                <h1 className="mb-2 text-2xl font-bold">{gone ? "This link is not available" : "Could not load this link"}</h1>
                <p className="mb-4 text-foreground/60">
                    {gone ? "It may have been turned off by its owner, or the address is wrong." : errorMessage(query.error)}
                </p>
                <div className="flex gap-2">
                    <Link href="/" className={btn}>Go to AlgoForge</Link>
                    {!gone && <button type="button" className={btn} onClick={() => void query.refetch()}>Try again</button>}
                </div>
            </PageShell>
        );
    }
    return (
        <PageShell wide>
            <SharedView share={query.data} />
        </PageShell>
    );
}
P9EOF

# SharedView: includes both cleanups from the write-up (useEffect for load, no useStore subscription)
put "$WEB/components/share/SharedView.tsx" <<'P9EOF'
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PublicCreator, PublicShareResponse, SharedAnalysisResponse, SharedExplainSessionResponse, SharedVisualizationResponse } from "@algoforge/contracts";
import { Markdown } from "@/components/DashBoard/Markdown";
import { ResultsScreen } from "@/components/DashBoard/Analysis";
import { VisualizerCanvas } from "@/components/visualizers/canvas";
import { createVisualizer } from "@/components/visualizers/engine";
import { compileScript } from "@/components/visualizers/script/compile";
import { saveScript } from "@/components/visualizers/script/storage";
import { PlayerChrome } from "@/components/visualizers/ui/PlayerChrome";
import { btn, btnPrimary } from "@/components/visualizers/shared/styles";
import { useWorkspace } from "@/lib/workspace/store";

const KIND = { analysis: "Code analysis", explain: "AI chat", visualization: "Visualization" } as const;
const CANVAS_CLASS = "relative min-h-[320px] w-full touch-none select-none overflow-hidden rounded-2xl border border-neutral-500/25 bg-neutral-500/5 outline-none";

function Header({ type, title, creator, createdAt, action }: { type: PublicShareResponse["type"]; title: string; creator?: PublicCreator; createdAt: string; action: React.ReactNode }) {
    const who = creator?.name ?? creator?.username ?? null;
    return (
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="mb-1 font-mono text-xs uppercase tracking-widest text-foreground/50">{KIND[type]} · read only</p>
                <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
                <p className="mt-1 text-sm text-foreground/60">
                    {who ? `Shared by ${who} · ` : "Shared · "}
                    {new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </p>
            </div>
            <div className="flex shrink-0 gap-2">{action}</div>
        </header>
    );
}

function Unreadable({ what }: { what: string }) {
    return (
        <div role="status" className="rounded-2xl border border-foreground/10 p-6 text-sm text-foreground/70">
            This {what} was saved in a format this version cannot display. Its owner can open it again from their dashboard.
        </div>
    );
}

function AnalysisShare({ data, creator, createdAt }: { data: SharedAnalysisResponse; creator?: PublicCreator; createdAt: string }) {
    const router = useRouter();
    const open = () => {
        // A private copy in this browser's editor. Nothing is written to the owner's account or to ours.
        const ws = useWorkspace.getState();
        ws.setLanguage(data.language);
        ws.setCode(data.code);
        router.push("/dashboard");
    };
    return (
        <>
            <Header type="analysis" title={`${data.language === "python" ? "Python" : "JavaScript"} analysis`} creator={creator} createdAt={createdAt} action={<button type="button" className={btnPrimary} onClick={open}>Open code in the editor</button>} />
            {data.result ? (
                <div className="h-[75vh] overflow-hidden rounded-2xl border border-foreground/10">
                    <ResultsScreen language={data.language} result={data.result} resetLabel="Open code in the editor" onReset={open} />
                </div>
            ) : (
                <Unreadable what="analysis" />
            )}
            <details className="mt-6 rounded-2xl border border-foreground/10 p-4">
                <summary className="cursor-pointer text-sm font-medium">The analyzed code</summary>
                <pre className="mt-3 overflow-x-auto font-mono text-[12.5px] leading-6"><code>{data.code}</code></pre>
            </details>
        </>
    );
}

function ExplainShare({ data, creator, createdAt }: { data: SharedExplainSessionResponse; creator?: PublicCreator; createdAt: string }) {
    return (
        <>
            <Header type="explain" title={data.title ?? "AI chat"} creator={creator} createdAt={createdAt} action={<Link href="/dashboard" className={btn}>Open AlgoForge</Link>} />
            <ol aria-label="Conversation" className="flex flex-col gap-4">
                {data.messages.map((m) => {
                    const user = m.role === "user";
                    return (
                        <li key={m.id} className={`flex ${user ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[88%] wrap-break-word rounded-2xl px-4 py-3 text-sm leading-relaxed ${user ? "whitespace-pre-wrap bg-foreground/10" : "border border-foreground/10 bg-foreground/[.03]"}`}>
                                <span className="sr-only">{user ? "Question: " : "Answer: "}</span>
                                {user ? m.content : <Markdown source={m.content} />}
                            </div>
                        </li>
                    );
                })}
            </ol>
            {data.messages.length === 0 && <p className="text-foreground/60">This chat has no messages.</p>}
        </>
    );
}

function VisualizationShare({ data, creator, createdAt }: { data: SharedVisualizationResponse; creator?: PublicCreator; createdAt: string }) {
    const router = useRouter();
    // A private store: it never touches the viewer's own visualizer or saved script.
    const [store] = useState(() => createVisualizer());
    const compiled = useMemo(() => compileScript(data.script), [data.script]);
    useEffect(() => {
        store.getState().load(compiled);
    }, [store, compiled]);

    const copy = () => {
        saveScript(data.script); // becomes the viewer's local script; they can save it to their own account
        useWorkspace.getState().setSavedVisualization(null);
        router.push("/dashboard?tab=visualizer");
    };
    return (
        <>
            <Header type="visualization" title={data.title} creator={creator} createdAt={createdAt} action={<button type="button" className={btnPrimary} onClick={copy}>Make your own copy</button>} />
            {data.description && <p className="mb-4 text-foreground/70">{data.description}</p>}
            {!compiled.ok && <p role="alert" className="mb-4 text-sm text-destructive">This script has problems and may not play fully.</p>}
            <div className="flex min-h-[320px] flex-col">
                <VisualizerCanvas store={store} className={CANVAS_CLASS} />
            </div>
            <div className="mt-4">
                <PlayerChrome store={store} />
            </div>
        </>
    );
}

export function SharedView({ share }: { share: PublicShareResponse }) {
    switch (share.type) {
        case "analysis":
            return <AnalysisShare data={share.data} creator={share.creator} createdAt={share.createdAt} />;
        case "explain":
            return <ExplainShare data={share.data} creator={share.creator} createdAt={share.createdAt} />;
        case "visualization":
            return <VisualizationShare data={share.data} creator={share.creator} createdAt={share.createdAt} />;
    }
}
P9EOF

# ===========================================================================
# Report
# ===========================================================================
echo
echo "=================================================================="
if [ -s "$P9_MANUAL" ]; then
  {
    echo "# Phase 9: steps that need a human"
    echo
    echo "The script could not apply these edits automatically (the existing code did not match"
    echo "the expected shape). Each entry lists the file and the snippet to apply by hand."
    echo
    cat "$P9_MANUAL"
  } > PHASE9_MANUAL_STEPS.md
  echo "Done, with $FAILS edit(s) that need manual attention."
  echo "See ./PHASE9_MANUAL_STEPS.md for the exact snippets."
else
  echo "Done. All edits applied."
fi
echo
echo "Next:"
echo "  1. git diff                      # review what changed"
echo "  2. pnpm db:backfill:phase5 && pnpm db:verify:phase5   # must print: All Phase 5 data checks passed."
echo "                                    # (after this change a legacy share without a shares row stops being public)"
echo "  3. pnpm install && pnpm db:generate"
echo "  4. pnpm typecheck && pnpm typecheck:web && pnpm lint && pnpm lint:web && pnpm test && pnpm build"
echo
echo "Likely small fixes after typecheck: withShareState generics and the serializeSharedAnalysis"
echo "argument shape. Possible leftovers: an unused import in a file where members were removed,"
echo "and the AnalysisHistory component needing an onSelect prop."
echo
echo "Smoke test (after pnpm dev, signed in; \$CSRF = af_csrf cookie value, cookies in jar.txt):"
cat <<'SMOKE'
  curl -b jar.txt -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json" \
    -d '{"type":"visualization","targetId":"seed_viz_1"}' localhost:4000/api/shares   # 200, url ends /s/<12 chars>
  curl localhost:4000/api/share/<id> -i                                               # 200, Cache-Control: public, no-cache
  curl -b jar.txt -H "X-CSRF-Token: $CSRF" -X DELETE localhost:4000/api/shares/<id> -i  # 204 (repeat: 204)
  curl localhost:4000/api/share/<id> -i                                               # 404, Cache-Control: no-store
SMOKE

if [ "$RUN_CHECKS" -eq 1 ]; then
  echo
  echo "==> Running checks (--run-checks)"
  set -e
  pnpm db:backfill:phase5
  pnpm db:verify:phase5
  pnpm install
  pnpm db:generate
  pnpm typecheck && pnpm typecheck:web
  pnpm lint && pnpm lint:web
  pnpm test
  pnpm build
fi