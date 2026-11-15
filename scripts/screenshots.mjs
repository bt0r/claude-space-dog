// Generates the README screenshots (animated GIFs) from the mod's own drawing code.
// Usage: node scripts/screenshots.mjs   (needs Node 23.6+, chromium and ImageMagick)
import { registerHooks } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The mod imports './sprites' without an extension; let Node find the .ts file.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.')) return next(`${specifier}.ts`, context)
      throw error
    }
  },
})

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { packSvg, BAND_HEIGHT } = await import(join(root, 'hooks/dog-svg.ts'))
const { skyFrame, SKY_FPS } = await import(join(root, 'hooks/sky.ts'))

const OUT = join(root, 'docs/screenshots')
const BAND_W = 460 // band width in mod pixels
const SCALE = 2
const W = BAND_W * SCALE
const SKY_H = 70
const PROMPT_H = 64
const H = SKY_H + BAND_HEIGHT * SCALE + PROMPT_H
const FPS = 10

const teckel = (mode, x = 120, extra = {}) => ({ id: 'main', breed: 'teckel', mode, x, dir: 1, seed: 3, ...extra })
const helper = (id, breed, mode, x, coat, extra = {}) => ({ id, breed, mode, x, dir: -1, seed: 5, coat, ...extra })

const STATES = [
  { name: 'walk', prompt: '', dogs: [teckel('walk', 40)], from: 0, seconds: 4 },
  { name: 'console', prompt: 'Can you add a dark mode toggle to the settings pa', dogs: [teckel('console')], from: 0, seconds: 3 },
  { name: 'pee', prompt: 'no, not like that', dogs: [teckel('pee')], from: 0, seconds: 4 },
  { name: 'ball', prompt: '', dogs: [teckel('ball', 120)], from: 0, seconds: 5 },
  { name: 'sit', prompt: '', dogs: [teckel('sit', 180)], from: 0, seconds: 3 },
  { name: 'eat', prompt: '', dogs: [teckel('eat', 160)], from: 0, seconds: 3 },
  { name: 'sleep', prompt: '', dogs: [teckel('sleep', 300)], from: 4, seconds: 4 },
  {
    name: 'pack',
    prompt: '',
    dogs: [
      teckel('ball', 40),
      helper('a1', 'pitbull', 'ball', 200, 0),
      helper('a2', 'berger', 'console', 300, 1),
      helper('a3', 'shiba', 'sit', 380, 2),
    ],
    from: 0,
    seconds: 5,
  },
  { name: 'spawn', prompt: '', dogs: [teckel('sit', 60), helper('a1', 'jack', 'ball', 260, 1, { spawn: true })], from: 0, seconds: 3 },
  { name: 'leave', prompt: '', dogs: [teckel('sit', 60), helper('a1', 'shiba', 'sit', 260, 0, { leaving: -0.8 })], from: 0, seconds: 3 },
]

const css = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#100f1d;width:${W}px}
  .f{position:relative;width:${W}px;height:${H}px;overflow:hidden}
  .f>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .band{position:absolute;left:0;top:${SKY_H}px;width:${W}px;height:${BAND_HEIGHT * SCALE}px}
  .prompt{position:absolute;left:16px;right:16px;bottom:12px;height:${PROMPT_H - 20}px;border-radius:12px;
    background:#1c1930;border:1px solid #3a3458;color:#e8e6f5;font:15px/1 ui-sans-serif,system-ui,sans-serif;
    display:flex;align-items:center;padding:0 16px}
  .prompt.empty{color:#7d7899}
  .caret{display:inline-block;width:2px;height:18px;background:#c7b8ff;margin-left:1px}`

function page(state) {
  const frames = state.seconds * FPS
  let body = ''

  for (let i = 0; i < frames; i++) {
    const t = state.from + i / FPS
    const sky = Buffer.from(skyFrame(Math.floor(t * SKY_FPS))).toString('base64')
    const band = packSvg(state.dogs, BAND_W).replace('<svg ', `<svg class="band" data-t="${t}" `)
    const text = state.prompt
      ? `<div class="prompt">${state.prompt}<span class="caret"></span></div>`
      : `<div class="prompt empty">Reply to Claude…</div>`
    body += `<div class="f"><img src="data:image/svg+xml;base64,${sky}">${band}${text}</div>`
  }

  const script = `for (const s of document.querySelectorAll('svg.band')) { s.pauseAnimations(); s.setCurrentTime(Number(s.dataset.t)) }`

  return { html: `<!doctype html><meta charset="utf-8"><style>${css}</style>${body}<script>${script}</script>`, frames }
}

mkdirSync(OUT, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'space-dog-shots-'))

try {
  for (const state of STATES) {
    const { html, frames } = page(state)
    const htmlPath = join(work, `${state.name}.html`)
    const strip = join(work, `${state.name}.png`)
    writeFileSync(htmlPath, html)
    execFileSync('chromium', [
      '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      `--window-size=${W},${H * frames}`, `--screenshot=${strip}`, `file://${htmlPath}`,
    ], { stdio: 'ignore' })
    const gif = join(OUT, `${state.name}.gif`)
    execFileSync('magick', [
      strip, '-crop', `${W}x${H}`, '+repage', '-set', 'delay', String(100 / FPS), '-loop', '0',
      '-layers', 'Optimize', gif,
    ])
    console.log(`${state.name}: ${frames} frames -> ${gif}`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
