/* Create the standalone publishing folder without moving the editable project. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { compactJs, compactCss } = require('./compact-assets.cjs');

function rebaseCssUrls(css, from, to) {
  return css.replace(/url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)/gi, (original, double, single, bare) => {
    const value = (double ?? single ?? bare).trim();
    // Data URLs, fragments and external/root URLs keep their original meaning.
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value) || value.includes('(')) return original;
    const resolved = new URL(value, 'https://mit-build.invalid/' + from);
    let relative = path.posix.relative(path.posix.dirname(to), resolved.pathname.slice(1));
    if (!relative.startsWith('.')) relative = './' + relative;
    return `url("${relative}${resolved.search}${resolved.hash}")`;
  });
}

function bundleStylesheets(html, readStylesheet) {
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  if (!head) throw new Error('A stylesheet bundle needs a document head.');
  const headStart = head.index + head[0].indexOf('>') + 1;
  const eligible = file => ['styles/tokens.css', 'styles/base.css', 'styles/components.css'].includes(file) || /^styles\/sections\/[^/]+\.css$/.test(file);
  const links = [];
  for (const match of head[1].matchAll(/<link\b[^>]*>/gi)) {
    const rel = /\brel\s*=\s*(["'])(.*?)\1/i.exec(match[0])?.[2] || '';
    if (!rel.split(/\s+/).includes('stylesheet')) continue;
    const file = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(match[0])?.[2] || '';
    if (eligible(file) && /\s(?:media|integrity|title)\s*=|\sdisabled(?:\s|>)/i.test(match[0])) throw new Error('Conditional stylesheet cannot be concatenated: ' + file);
    links.push({ file, start: headStart + match.index, end: headStart + match.index + match[0].length, eligible: eligible(file) });
  }
  const groups = [];
  let current = null;
  links.forEach(link => {
    if (!link.eligible) { current = null; return; }
    if (!current) { current = []; groups.push(current); }
    current.push(link);
  });
  if (groups.length > 2) throw new Error('Non-woodland styles must form at most two contiguous groups.');
  const bundles = new Map(), sources = new Set(), replacements = [];
  groups.forEach((group, index) => {
    // Keep the foundation before the renderer and sections after it. Moving a
    // single combined file across the renderer would change its CSS cascade.
    const output = groups.length === 2 && index === 0 ? 'styles/foundation.css' : 'styles/site.css';
    const css = group.map(link => {
      sources.add(link.file);
      const sourceCss = readStylesheet(link.file);
      if (/@import\b/i.test(sourceCss)) throw new Error('Move stylesheet imports into the HTML before bundling: ' + link.file);
      return `/* ${link.file} */\n` + rebaseCssUrls(sourceCss.replace(/^\uFEFF?\s*@charset\s+[^;]+;\s*/i, ''), link.file, output);
    }).join('\n\n');
    bundles.set(output, css + '\n');
    group.forEach((link, position) => replacements.push({ ...link, text: position === 0 ? `<link rel="stylesheet" href="${output}">` : '' }));
  });
  let published = html;
  replacements.sort((a, b) => b.start - a.start).forEach(change => {
    published = published.slice(0, change.start) + change.text + published.slice(change.end);
  });
  return { html: published, bundles, sources };
}

function build(argv = process.argv.slice(2)) {
const source = path.resolve(__dirname, '..');
const workspace = path.dirname(source);
const outputIndex = argv.indexOf('--output');
if (outputIndex !== -1 && !argv[outputIndex + 1]) throw new Error('--output needs a folder path.');
const destination = outputIndex === -1 ? path.join(workspace, 'site') : path.resolve(source, argv[outputIndex + 1]);
if (!destination.startsWith(workspace + path.sep) || destination === source || source.startsWith(destination + path.sep)) throw new Error('Publishing output must be a separate folder inside the workspace.');
const manifestFile = path.join(path.dirname(destination), path.basename(destination) + '-manifest.json');
const files = new Set(['index.html', 'pages/main.html', 'scripts/committee.json', 'scripts/photos.json', 'scripts/posters.json']);
files.add('scripts/vendor/PapaParse-LICENSE.txt');
const html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="((?:scripts|styles)\/[^"?#]+\.(?:js|css))"/g)) files.add(match[1]);
const generated = new Map();
for (const name of ['MIT-Website-CMS.csv', 'MIT-Workshops-Only.csv']) {
  const output = 'cms-templates/' + name;
  files.add(output); generated.set(output, fs.readFileSync(path.join(source, 'cms/templates', name), 'utf8'));
}
if (argv.includes('--bundle-styles')) {
  const readStyle = file => fs.readFileSync(path.join(source, file), 'utf8');
  const main = bundleStylesheets(html, readStyle);
  const legacy = bundleStylesheets(fs.readFileSync(path.join(source, 'pages/main.html'), 'utf8'), readStyle);
  if (JSON.stringify([...main.bundles]) !== JSON.stringify([...legacy.bundles])) throw new Error('Homepage and legacy stylesheet order differ.');
  generated.set('index.html', main.html);
  generated.set('pages/main.html', legacy.html);
  for (const [file, css] of main.bundles) { files.add(file); generated.set(file, css); }
  for (const file of main.sources) files.delete(file);
}

// The editable project stays split. Production keeps the same cascade and
// execution order in one CSS file and two independently loaded script groups.
if (!argv.includes('--no-optimize')) {
  const read = file => generated.get(file) ?? fs.readFileSync(path.join(source, file), 'utf8');
  function optimize(entry) {
    let document = read(entry);
    const links = [...document.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="(styles\/[^"?#]+\.css)"[^>]*>/g)];
    const cssFile = 'styles/app.min.css';
    const css = links.map(match => compactCss(rebaseCssUrls(read(match[1]), match[1], cssFile))).join('\n');
    links.forEach((match, index) => { document = document.replace(match[0], index ? '' : `<link rel="stylesheet" href="${cssFile}">`); });
    const critical = [...document.matchAll(/<script\b[^>]*\bsrc="(scripts\/[^"?#]+\.js)"[^>]*><\/script>/g)].filter(match => !match[0].includes('data-forest-src') && match[1] !== 'scripts/sheet-cms-config.js');
    const forest = [...document.matchAll(/<script\b[^>]*data-forest-src="(scripts\/[^"?#]+\.js)"[^>]*><\/script>/g)];
    const scripts = new Map();
    for (const [group, name] of [[critical, 'scripts/app.min.js'], [forest, 'scripts/forest.min.js']]) {
      if (!group.length) continue;
      scripts.set(name, group.map(match => match[1].startsWith('scripts/vendor/') ? read(match[1]) : compactJs(read(match[1]))).join('\n;\n'));
      group.forEach((match, index) => { document = document.replace(match[0], index ? '' : name.includes('forest') ? `<script type="text/plain" data-forest-src="${name}"></script>` : `<script src="${name}" defer></script>`); });
    }
    return { html: document, css, scripts, retired: [...links, ...critical, ...forest].map(match => match[1]) };
  }
  const main = optimize('index.html'), legacy = optimize('pages/main.html');
  if (main.css !== legacy.css || JSON.stringify([...main.scripts]) !== JSON.stringify([...legacy.scripts])) throw new Error('Publishing entry dependencies differ.');
  generated.set('index.html', main.html); generated.set('pages/main.html', legacy.html);
  for (const retired of main.retired) files.delete(retired);
  files.add('styles/app.min.css'); generated.set('styles/app.min.css', main.css);
  for (const [name, script] of main.scripts) { files.add(name); generated.set(name, script); }
}

const siteUrlIndex = argv.indexOf('--site-url');
if (siteUrlIndex !== -1) {
  const value = argv[siteUrlIndex + 1];
  if (!value) throw new Error('--site-url needs the public website URL.');
  const publicUrl = new URL(value);
  if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash) throw new Error('--site-url must be a public HTTPS base URL.');
  const base = publicUrl.href.replace(/\/?$/, '/');
  for (const entry of ['index.html', 'pages/main.html']) {
    const page = generated.get(entry) ?? fs.readFileSync(path.join(source, entry), 'utf8');
    generated.set(entry, page.replace(/https:\/\/golden-moonbeam-a2a58f\.netlify\.app\/(?=assets\/)/g, base));
  }
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Publishing cannot include symlinks: ' + file);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
// Keep web delivery variants, including dynamically selected forest templates.
for (const file of walk(path.join(source, 'assets'))) {
  const relative = path.relative(source, file).split(path.sep).join('/');
  // Superseded delivery files remain available in the editable project.
  if (/^assets\/images\/photos\/thumbs\//.test(relative)) continue;
  if (/^assets\/images\/committee\/portraits\/(?:alfred|elayna|kar-way|natalie|puteri|yamone)\.webp$/.test(relative)) continue;
  if (relative === 'assets/images/woodland-butterfly/flutter-sheet-v2.webp') continue;
  if (relative === 'assets/images/woodland-editor/lantern-animation/lantern-frames.webp') continue;
  if (/^assets\/images\/bear-animation\/(?:sewing|printer|hero)\/poses-v1\.webp$/.test(relative)) continue;
  if (/[/\\]hammer-animation[/\\]frame-0[12]\.webp$/i.test(file)) continue; // Retained source poses are superseded by the native-alpha sheet.
  if (/[/\\]hammer-animation[/\\]generated-poses-v2\.webp$/i.test(file)) continue; // Rejected partial-arm sheet is retained only in the editable project.
  if (/\.(?:webp|svg)$/i.test(file)) files.add(path.relative(source, file).split(path.sep).join('/'));
}
for (const name of ['hammer', 'fired-up', 'little-maker']) files.add('assets/images/mascots/mit-mascot-' + name + '.png');
// Originals stay in the editable project. Public crew records only contain
// the WebP preview and portrait paths actually used by the website.
const publicJson = new Map();
for (const file of [...files].filter(file => file.endsWith('.json'))) {
  let text = fs.readFileSync(path.join(source, file), 'utf8');
  if (file === 'scripts/committee.json') {
    const records = JSON.parse(text).map(({ sourceImage, ...person }) => person);
    text = JSON.stringify(records, null, 2) + '\n';
    publicJson.set(file, text);
  }
  for (const match of text.matchAll(/"(assets\/[^"?#]+\.(?:png|jpe?g|webp|svg))"/g)) files.add(match[1]);
}

function outputPath(relative) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part === '..' || part === '.git')) throw new Error('Unsafe publishing path: ' + relative);
  const result = path.resolve(destination, relative);
  if (!result.startsWith(destination + path.sep)) throw new Error('Path outside site: ' + relative);
  return result;
}
const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
if (fs.existsSync(destination) && !previous) throw new Error('An existing site folder has no build manifest; preserve it before rebuilding.');
const next = new Set([...files, '.nojekyll']);
// Only retire files recorded by this builder, preserving anything added by hand.
for (const file of previous?.files || []) {
  if (!next.has(file.path) && fs.existsSync(outputPath(file.path))) fs.unlinkSync(outputPath(file.path));
}
fs.mkdirSync(destination, { recursive: true });
for (const relative of files) {
  const input = path.join(source, relative);
  if (!generated.has(relative) && (!fs.existsSync(input) || !fs.statSync(input).isFile())) throw new Error('Missing deployment file: ' + relative);
  const target = outputPath(relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (generated.has(relative)) fs.writeFileSync(target, generated.get(relative));
  else if (publicJson.has(relative)) fs.writeFileSync(target, publicJson.get(relative));
  else fs.copyFileSync(input, target);
}
fs.writeFileSync(path.join(destination, '.nojekyll'), '');
const entries = [...next].sort().map(relative => {
  const content = fs.readFileSync(outputPath(relative));
  return { path: relative, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex'), gitSha: crypto.createHash('sha1').update('blob ' + content.length + '\0').update(content).digest('hex') };
});
fs.writeFileSync(manifestFile, JSON.stringify({ source, destination, files: entries, bytes: entries.reduce((total, item) => total + item.bytes, 0) }, null, 2) + '\n');
console.log(JSON.stringify({ folder: destination, files: entries.length, megabytes: +(entries.reduce((total, item) => total + item.bytes, 0) / 1048576).toFixed(2) }));
return { destination, files: entries };
}

if (require.main === module) build();
module.exports = Object.freeze({ build, bundleStylesheets, rebaseCssUrls });
