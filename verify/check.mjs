// Color and landing checks for the spinner, plus screenshot regeneration.
//
//   npm run verify        # palette + forced-landing checks
//   npm run shots        # the above, then rewrite screenshots/{light,dark}.png
//
// Dev-only tooling: the page itself stays a single dependency-free file.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright';

const { chromium } = pw;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WANT_SHOTS = process.argv.includes('--shots');

const CATS = [
  { id: 'ciencias',       name: 'Ciências',       color: '#58AB60', ink: '#2C5630' },
  { id: 'arte',           name: 'Arte',           color: '#E1332D', ink: '#701A16' },
  { id: 'esportes',       name: 'Esportes',       color: '#F19106', ink: '#784803' },
  { id: 'coroa',          name: 'Coroa',          color: '#83509C', ink: '#42284E' },
  { id: 'entretenimento', name: 'Entretenimento', color: '#D55F99', ink: '#6A304C' },
  { id: 'historia',       name: 'História',       color: '#ECD207', ink: '#766904' },
  { id: 'geografia',      name: 'Geografia',      color: '#3570B2', ink: '#1A3859' },
];

// Mirrors onFill() in index.html: white where it holds up, a dark tint of the fill where it does not.
const MIN_CONTRAST = 3;
const DARK_TINT = 0.25;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toRGB = (hex) => `rgb(${rgb(hex).join(', ')})`;
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
const shade = (hex, k) =>
  '#' + rgb(hex).map((c) => Math.max(0, Math.min(255, Math.round(c * k))).toString(16).padStart(2, '0')).join('');
const inkOn = (hex) => (1.05 / (lum(hex) + 0.05) >= MIN_CONTRAST ? '#ffffff' : shade(hex, DARK_TINT));
const rgbName = (hex) => toRGB(hex.toUpperCase());

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.css': 'text/css',
  '.js': 'text/javascript',
};

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const fails = [];
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) fails.push(msg);
};

const server = await serve();
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch();

// ---- palette: wedges, legend dots and icon strokes, with Coroa on and off ----
for (const crown of [true, false]) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  if (!crown) {
    await page.click('#tCrown');
    await page.waitForTimeout(200);
  }
  const cats = crown ? CATS : CATS.filter((c) => c.id !== 'coroa');

  const wedges = await page.$$eval('#wedges path', (els) => els.map((e) => e.getAttribute('fill')));
  check(wedges.length === cats.length, `crown=${crown}: ${wedges.length} setores desenhados (esperado ${cats.length})`);
  cats.forEach((c, i) => check(wedges[i] === c.color, `crown=${crown}: setor ${i} (${c.name}) fill=${wedges[i]}`));

  const dots = await page.$$eval('#dots i', (els) => els.map((e) => getComputedStyle(e).backgroundColor));
  cats.forEach((c, i) => check(dots[i] === toRGB(c.color), `crown=${crown}: dot ${i} (${c.name}) = ${dots[i]}`));

  const strokes = await page.$$eval('#wedges g', (els) => els.map((e) => e.getAttribute('stroke')));
  cats.forEach((c, i) => check(strokes[i] === c.ink, `crown=${crown}: icone ${i} (${c.name}) stroke=${strokes[i]}`));
  await ctx.close();
}

// ---- landing: force a stop on every category, check the announced card stays readable ----
for (const c of CATS) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 }, reducedMotion: 'reduce' });
  // spin() draws the target first: floor(random * n). Pinning random pins the target.
  await ctx.addInitScript(({ i, n }) => { Math.random = () => (i + 0.5) / n; },
                         { i: CATS.indexOf(c), n: CATS.length });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.click('#board');
  await page.waitForTimeout(150);

  const got = await page.evaluate(() => {
    const res = document.getElementById('result');
    const name = document.getElementById('resultName');
    const chip = document.querySelector('.strip .chip:first-child');
    return {
      state: res.dataset.state,
      name: name.textContent,
      cardBg: getComputedStyle(res).backgroundColor,
      nameColor: getComputedStyle(name).color,
      chipColor: chip ? getComputedStyle(chip).color : null,
    };
  });

  check(got.state === 'hit' && got.name === c.name, `${c.name}: seta parou em "${got.name}" (estado ${got.state})`);
  check(got.cardBg === toRGB(c.color), `${c.name}: cartao de resultado com fundo ${got.cardBg}`);
  check(got.nameColor === rgbName(inkOn(c.color)), `${c.name}: nome em ${got.nameColor} (esperado ${rgbName(inkOn(c.color))})`);
  check(got.chipColor === got.nameColor, `${c.name}: chip mais recente na mesma tinta (${got.chipColor})`);

  const hex = (s) => '#' + s.match(/\d+/g).map((x) => (+x).toString(16).padStart(2, '0')).join('');
  const ratio = contrast(hex(got.nameColor), c.color);
  check(ratio >= MIN_CONTRAST, `${c.name}: contraste nome/fundo ${ratio.toFixed(2)}:1 (minimo ${MIN_CONTRAST}:1)`);
  await ctx.close();
}

// ---- wake lock: the screen stays on while the page is visible ----
// The page asks for the Screen Wake Lock on load and re-asks on every return to visibility,
// because the platform releases the sentinel on its own when the document goes hidden and a
// released sentinel cannot be reused. navigator.wakeLock and document.visibilityState are
// stubbed here, so the logic is checked deterministically rather than by putting a real
// phone to sleep.
async function wakeLockHarness({ supported = true, visibleAtLoad = 'visible', deferred = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 820 } });
  await ctx.addInitScript(({ supported, visibleAtLoad, deferred }) => {
    const wl = { requests: [], sentinels: [], resolvers: [] };
    window.__wl = wl;

    let visible = visibleAtLoad;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible });
    // Going hidden drops every live sentinel, the way the platform does: a lock granted before
    // the hide cannot survive it, and the sentinel is dead afterwards.
    window.__setVisible = (v) => {
      visible = v;
      if (v === 'hidden') {
        wl.sentinels.forEach((s) => { if (!s.released) { s.released = true; s.dispatchEvent(new Event('release')); } });
      }
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.__settle = () => { const rs = wl.resolvers.splice(0); rs.forEach((f) => f()); };

    if (!supported) {
      // Chromium ships the real API, so "no API" has to delete it: otherwise the scenario keeps
      // a live navigator.wakeLock and never exercises the feature-detection guard.
      delete Navigator.prototype.wakeLock;
      return;
    }

    class FakeSentinel extends EventTarget {
      constructor() { super(); this.released = false; }
      release() { this.released = true; this.dispatchEvent(new Event('release')); return Promise.resolve(); }
    }

    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request(type) {
          const s = new FakeSentinel();
          wl.requests.push(type);
          wl.sentinels.push(s);
          if (!deferred) return Promise.resolve(s);
          return new Promise((resolve) => { wl.resolvers.push(() => resolve(s)); });
        },
      },
    });
  }, { supported, visibleAtLoad, deferred });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  return { ctx, page, errors };
}

const wlReqs = (page) => page.evaluate(() => window.__wl.requests.slice());
const wlHeld = (page) => page.evaluate(() => window.__wl.sentinels.filter((s) => !s.released).length);

// held while visible, re-requested after the platform drops it on a hide
{
  const { ctx, page, errors } = await wakeLockHarness();
  check(JSON.stringify(await wlReqs(page)) === '["screen"]', `wake lock: 1 request do tipo screen no load (${JSON.stringify(await wlReqs(page))})`);
  check((await wlHeld(page)) === 1, `wake lock: o request do load voltou um sentinel nao liberado (${await wlHeld(page)})`);

  // a visibilitychange that arrives while a live lock is already held must not ask for a second one
  await page.evaluate(() => window.__setVisible('visible'));
  await page.waitForTimeout(120);
  check((await wlReqs(page)).length === 1, `wake lock: visibilitychange redundante com lock vivo nao pede outro (${(await wlReqs(page)).length} requests)`);

  await page.evaluate(() => window.__setVisible('hidden'));
  await page.waitForTimeout(80);
  await page.evaluate(() => window.__setVisible('visible'));
  await page.waitForTimeout(150);
  check((await wlReqs(page)).length === 2, `wake lock: re-request ao voltar a visibilidade (${(await wlReqs(page)).length} requests)`);

  // the platform takes the lock back while the page stays visible (power saving): the release
  // handler must clear the reference, or the next round trip finds a "held" lock already dead
  await page.evaluate(() => window.__wl.sentinels[1].release());
  await page.waitForTimeout(80);
  check((await wlReqs(page)).length === 2, `wake lock: revogado em visibilidade, nao re-pede na hora (${(await wlReqs(page)).length} requests)`);
  await page.evaluate(() => window.__setVisible('hidden'));
  await page.evaluate(() => window.__setVisible('visible'));
  await page.waitForTimeout(150);
  check((await wlReqs(page)).length === 3, `wake lock: re-request apos a plataforma revogar o sentinel (${(await wlReqs(page)).length} requests)`);
  check(errors.length === 0, `wake lock: sem erros de pagina (${errors.join(' | ') || 'nenhum'})`);
  await ctx.close();
}

// opened in a background tab: nothing requested until it becomes visible
{
  const { ctx, page } = await wakeLockHarness({ visibleAtLoad: 'hidden' });
  check((await wlReqs(page)).length === 0, `wake lock: nenhum request com o documento oculto no load (${(await wlReqs(page)).length})`);
  await page.evaluate(() => window.__setVisible('visible'));
  await page.waitForTimeout(150);
  check((await wlReqs(page)).length === 1, `wake lock: request ao abrir a aba (${(await wlReqs(page)).length})`);
  await ctx.close();
}

// a visibility round trip while a request is in flight must not stack a second one, and a
// sentinel that arrives already released must not be mistaken for a live lock
{
  const { ctx, page } = await wakeLockHarness({ deferred: true });
  check((await wlReqs(page)).length === 1, `wake lock: request pendente apos o load (${(await wlReqs(page)).length})`);
  await page.evaluate(() => { window.__setVisible('hidden'); window.__setVisible('visible'); });
  await page.waitForTimeout(80);
  check((await wlReqs(page)).length === 1, `wake lock: round trip com request em voo nao empilha (${(await wlReqs(page)).length})`);
  await page.evaluate(() => window.__settle());
  await page.waitForTimeout(150);
  // the sentinel that arrives here was already released by the hide above, so the page must not
  // treat it as a lock it owns. That is proven by the next check: a page holding the dead one
  // would never ask again. Counting the stub's unreleased sentinels here would pass either way.
  await page.evaluate(() => { window.__setVisible('hidden'); window.__setVisible('visible'); });
  await page.waitForTimeout(150);
  check((await wlReqs(page)).length === 2, `wake lock: round trip seguinte volta a pedir (${(await wlReqs(page)).length})`);
  await page.evaluate(() => window.__settle());
  await page.waitForTimeout(150);
  check((await wlHeld(page)) === 1, `wake lock: o novo request voltou um sentinel nao liberado (${await wlHeld(page)})`);
  await ctx.close();
}

// no Screen Wake Lock API: inert, and the spinner keeps working
{
  const { ctx, page, errors } = await wakeLockHarness({ supported: false });
  const hasApi = await page.evaluate(() => 'wakeLock' in navigator);
  check(hasApi === false, `wake lock: a stub remove mesmo a API nativa ('wakeLock' in navigator = ${hasApi})`);
  check(errors.length === 0, `wake lock: sem API, sem erro de pagina (${errors.join(' | ') || 'nenhum'})`);
  await page.click('#board');
  await page.waitForTimeout(150);
  const spinning = await page.evaluate(() => ({
    disabled: document.getElementById('board').disabled,
    eyebrow: document.getElementById('resultEyebrow').textContent,
  }));
  check(spinning.disabled === true && spinning.eyebrow === 'girando',
        `wake lock: sem API, a roleta continua girando (disabled=${spinning.disabled}, "${spinning.eyebrow}")`);
  await ctx.close();
}

// ---- screenshots: same framing as the ones the readme embeds ----
if (WANT_SHOTS) {
  const SHOTS = [
    { file: 'screenshots/light.png', scheme: 'light', spins: ['geografia', 'esportes', 'historia', 'entretenimento', 'ciencias'] },
    { file: 'screenshots/dark.png',  scheme: 'dark',  spins: ['arte', 'geografia', 'esportes', 'coroa', 'entretenimento'] },
  ];
  for (const shot of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: 520, height: 862 },
      deviceScaleFactor: 2,
      colorScheme: shot.scheme,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    for (const id of shot.spins) {
      await page.evaluate(({ i, n }) => { Math.random = () => (i + 0.5) / n; },
                         { i: CATS.findIndex((c) => c.id === id), n: CATS.length });
      await page.click('#board');
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(900); // let the land/pop animations settle

    const got = await page.evaluate(() => ({
      announced: document.getElementById('resultName').textContent,
      chips: [...document.querySelectorAll('.strip .chip')].map((c) => c.textContent.trim()),
      cats: document.getElementById('brandSub').textContent,
    }));
    const last = CATS.find((c) => c.id === shot.spins[shot.spins.length - 1]);
    const wantChips = [...shot.spins].reverse().map((id) => CATS.find((c) => c.id === id).name);

    check(got.announced === last.name, `${shot.file}: anuncia "${got.announced}"`);
    check(JSON.stringify(got.chips) === JSON.stringify(wantChips), `${shot.file}: historico ${JSON.stringify(got.chips)}`);
    check(got.cats === '7 categorias', `${shot.file}: ${got.cats}`);

    await page.screenshot({ path: path.join(ROOT, shot.file) });
    console.log(`      ${shot.file} regravada`);
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} FALHAS` : '\nTudo verificado.');
process.exit(fails.length ? 1 : 0);
