// Build estático: inlinea CSS/JS en el HTML, fingerprintea src/static/** y minifica.
// Salida en dist/, lista para subir tal cual al servidor.
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'html-minifier-terser';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (!e.name.startsWith('.')) out.push(p);
  }
  return out;
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// 1. Archivos estáticos con hash de contenido en el nombre → cache inmutable de 1 año
const map = new Map();
for (const file of await walk(join(SRC, 'static'))) {
  const buf = await readFile(file);
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 10);
  const rel = relative(SRC, file).split('\\').join('/');
  const ext = extname(rel);
  const hashed = `${rel.slice(0, -ext.length)}.${hash}${ext}`;
  await mkdir(dirname(join(DIST, hashed)), { recursive: true });
  await writeFile(join(DIST, hashed), buf);
  map.set(rel, hashed);
}

// 2. HTML con CSS y JS inline (cero peticiones bloqueantes)
let html = await readFile(join(SRC, 'index.html'), 'utf8');
const css = await readFile(join(SRC, 'styles.css'), 'utf8');
const js = await readFile(join(SRC, 'main.js'), 'utf8');
html = html
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>${css}</style>`)
  .replace('<script src="main.js"></script>', () => `<script>${js}</script>`);

// Reemplazo por longitud descendente para no pisar rutas que sean prefijo de otras
for (const [from, to] of [...map].sort((a, b) => b[0].length - a[0].length)) {
  html = html.split(from).join(to);
}

html = await minify(html, {
  collapseWhitespace: true,
  conservativeCollapse: false,
  removeComments: true,
  minifyCSS: true,
  minifyJS: { compress: { passes: 2 }, mangle: true },
  processScripts: ['application/ld+json'],
  removeRedundantAttributes: true,
  sortAttributes: true,
  sortClassName: true,
  useShortDoctype: true,
});

// 3. Verificación: toda ruta static/ referenciada debe existir en dist
const refs = [...new Set(html.match(/static\/[\w./-]+\.(?:avif|webp|jpg|png|woff2)/g) || [])];
const missing = [];
for (const r of refs) {
  try { await stat(join(DIST, r)); } catch { missing.push(r); }
}
if (missing.length) {
  console.error('Referencias rotas:', missing);
  process.exit(1);
}
const unused = [...map.values()].filter(v => !refs.includes(v));
if (unused.length) console.warn('Assets sin referenciar (se publican igual):', unused);

await writeFile(join(DIST, 'index.html'), html);

// 4. public/ se copia sin tocar (robots, sitemap, iconos, OG, .htaccess)
await cp(join(ROOT, 'public'), DIST, { recursive: true });

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`dist/index.html ${kb(Buffer.byteLength(html))} · ${map.size} assets fingerprinteados · ${refs.length} referencias verificadas`);
