// Compose les animations du teckel à la volée (SVG + SMIL).
//
// Chaque animation part de la position et de la direction où le chien se trouve, et
// sa boucle revient à ce point : un changement d'animation ne le fait jamais sauter.
// Une animation est une « trajectoire » : une suite de segments (pose, durée, x de
// départ et d'arrivée, direction). La même trajectoire sert à dessiner le SVG et à
// calculer où en est le chien au moment où l'animation change.

import type { DogDir, DogMode, HelperBreed, PackDog } from '../types'
import { COLORS, SPRITES } from './sprites'

export const BAND_HEIGHT = 36
const PX = 2
const GROUND = 32 // dessus du plancher, sous les pattes
export const DOG_W = spriteWidth(SPRITES.walkA) // 68 px

const WALK_SPEED = 40 // px/s
const RUN_SPEED = 110 // px/s
const EDGE_PAUSE = 2 // s, au bout du bandeau
const THROWS = 6 // lancers au hasard avant de revenir au point de départ (la boucle)
const THROW_MIN = 120 // px : un lancer plus court est retiré au sort
const PLANT_X = 6 // px, la plante à gauche
const BASKET_FROM_RIGHT = 96 // px, le panier à droite
const DOG_IN_BASKET = 8 // px, le chien couché dans le panier

type Sprite = readonly string[]
/** Une robe : des couleurs de remplacement pour certaines lettres du sprite. */
type Tint = { id: string; colors: Readonly<Record<string, string>> }
type Pose = 'walk' | 'stand' | 'run' | 'carry' | 'carryStand' | 'eat' | 'console' | 'pee' | 'sleep' | 'sit'
type Segment = { pose: Pose; dur: number; x0: number; x1: number; dir: DogDir }
type Track = { segments: Segment[]; period: number }
export type DogPosition = { x: number; dir: DogDir; seed?: number }

const mirrorCache = new Map<Sprite, Sprite>()

function mirror(sprite: Sprite): Sprite {
  let m = mirrorCache.get(sprite)

  if (m === undefined) {
    m = sprite.map(row => [...row].reverse().join(''))
    mirrorCache.set(sprite, m)
  }

  return m
}

function facing(sprite: Sprite, dir: DogDir): Sprite {
  return dir > 0 ? sprite : mirror(sprite)
}

function spriteWidth(sprite: Sprite): number {
  return (sprite[0] ?? '').length * PX
}

// Chaque image n'est écrite qu'une fois par SVG (dans <defs>) puis réutilisée par <use> :
// le SVG reste sous la limite de taille de l'app même avec plusieurs chiens.
let defIds = new Map<Sprite, Map<string, string>>()
let defs: string[] = []

function resetDefs(): void {
  defIds = new Map()
  defs = []
}

/** Le sprite posé sur le sol par défaut, à `ox` ; écrit une fois dans <defs>. */
function draw(sprite: Sprite, ox = 0, oy = GROUND - sprite.length * PX, screen = false, tint?: Tint): string {
  const key = `${oy}:${screen ? 1 : 0}:${tint?.id ?? ''}`
  let byKey = defIds.get(sprite)

  if (byKey === undefined) {
    byKey = new Map()
    defIds.set(sprite, byKey)
  }
  let id = byKey.get(key)

  if (id === undefined) {
    id = `s${defs.length}`
    byKey.set(key, id)
    defs.push(`<g id="${id}">${rects(sprite, oy, screen, tint)}</g>`)
  }

  return ox === 0 ? `<use href="#${id}"/>` : `<use href="#${id}" x="${ox}"/>`
}

/** Le sprite en un chemin par couleur (pixels voisins fusionnés) ; l'écran de la console scintille. */
function rects(sprite: Sprite, oy: number, screen: boolean, tint?: Tint): string {
  const color = (ch: string) => tint?.colors[ch] ?? COLORS[ch]
  const paths = new Map<string, string>()
  let animated = ''
  let n = 0

  sprite.forEach((row, y) => {
    let x = 0

    while (x < row.length) {
      const ch = row[x] ?? '.'

      if (ch === '.') {
        x += 1
        continue
      }

      if (ch === 'S' && screen) {
        n += 1
        animated +=
          `<rect x="${x * PX}" y="${oy + y * PX}" width="${PX}" height="${PX}" fill="${COLORS[ch]}">` +
          `<animate attributeName="fill" values="#5ec2ff;#9ef0c9;#3d8fd0" dur="1.2s" begin="-${((n % 3) * 0.4).toFixed(1)}s" ` +
          `repeatCount="indefinite" calcMode="discrete"/></rect>`
        x += 1
        continue
      }

      let end = x

      while (end + 1 < row.length && row[end + 1] === ch) {
        end += 1
      }
      const w = (end - x + 1) * PX
      paths.set(ch, `${paths.get(ch) ?? ''}M${x * PX} ${oy + y * PX}h${w}v${PX}h-${w}z`)
      x = end + 1
    }
  })

  let out = ''

  for (const [ch, d] of paths) {
    out += `<path fill="${color(ch)}" d="${d}"/>`
  }

  return out + animated
}

/** Alterne des images en boucle (pattes, respiration, queue…). */
function flip(frames: string[], dur: number): string {
  if (frames.length === 1) {
    return frames[0] ?? ''
  }
  const n = frames.length
  const keyTimes = frames.map((_, j) => (j / n).toFixed(3)).join(';')

  return frames
    .map((content, i) => {
      const values = frames.map((_, j) => (j === i ? '1' : '0')).join(';')

      return (
        `<g opacity="${i === 0 ? 1 : 0}"><animate attributeName="opacity" values="${values}" keyTimes="${keyTimes}" ` +
        `dur="${dur}s" repeatCount="indefinite" calcMode="discrete"/>${content}</g>`
      )
    })
    .join('')
}

/** Des Z qui montent au-dessus de la tête d'un chien qui dort. */
function zzz(dir: DogDir, dogW: number): string {
  const zx = dir > 0 ? dogW - 6 : -6

  return [0, 1, 2]
    .map(
      i =>
        `<g opacity="0">${draw(SPRITES.zed, zx + i * 7 * dir, 2)}` +
        `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.2;.7;1" dur="3s" begin="${i}s" repeatCount="indefinite"/>` +
        `<animateTransform attributeName="transform" type="translate" values="0 6;${4 * dir} -2" dur="3s" begin="${i}s" repeatCount="indefinite"/></g>`,
    )
    .join('')
}

/** Une pose dessinée à l'origine, tournée dans sa direction (la trajectoire la déplace). */
function poseContent(pose: Pose, dir: DogDir): string {
  const S = SPRITES
  const right = dir > 0

  switch (pose) {
    case 'walk':
      return flip([draw(facing(S.walkA, dir)), draw(facing(S.walkB, dir))], 0.6)
    case 'run':
      return flip([draw(facing(S.walkA, dir)), draw(facing(S.walkB, dir))], 0.24)
    case 'stand':
      return draw(facing(S.walkA, dir))
    case 'carry':
      return flip([draw(facing(S.carryA, dir)), draw(facing(S.carryB, dir))], 0.24)
    case 'carryStand':
      return draw(facing(S.carryA, dir))
    case 'eat': {
      const bowlX = right ? DOG_W - 12 : 12 - spriteWidth(S.bowl)

      return flip([draw(facing(S.eatA, dir)), draw(facing(S.eatB, dir))], 0.8) + draw(S.bowl, bowlX)
    }
    case 'console': {
      const deviceX = right ? DOG_W + 2 : -2 - spriteWidth(S.consoleDevice)

      return draw(facing(S.console, dir)) + draw(S.consoleDevice, deviceX, undefined, true)
    }
    case 'pee': {
      // La borne derrière lui, la patte arrière levée au-dessus des gouttes.
      const hydrantX = right ? -spriteWidth(S.hydrant) - 2 : DOG_W + 2
      const dropX = right ? 2 : DOG_W - 4
      const drops = [0, 1, 2]
        .map(
          i =>
            `<rect x="${dropX}" y="${GROUND - 10}" width="2" height="2" fill="${COLORS.g}">` +
            `<animate attributeName="y" values="${GROUND - 10};${GROUND - 2}" dur=".45s" begin="-${(i * 0.15).toFixed(2)}s" repeatCount="indefinite"/></rect>`,
        )
        .join('')
      const puddleX = right ? dropX - 10 : dropX - 6
      const puddle =
        `<rect x="${puddleX}" y="${GROUND - 1}" height="2" width="2" fill="${COLORS.g}" opacity=".8">` +
        `<animate attributeName="width" values="2;18" dur="5s" fill="freeze"/></rect>`

      return draw(S.hydrant, hydrantX) + draw(facing(S.pee, dir)) + drops + puddle
    }
    case 'sleep': {
      // Couché dans le panier : le ventre passe sous le rebord avant (dessiné par-dessus).
      const zs = zzz(dir, DOG_W)

      const oy = GROUND - S.sleepA.length * PX - 4

      return flip([draw(facing(S.sleepA, dir), 0, oy), draw(facing(S.sleepB, dir), 0, oy)], 3) + zs
    }
    case 'sit': {
      // La tête assise s'aligne sur la tête debout.
      const ox = right ? DOG_W - spriteWidth(S.sitA) : 0
      const a = draw(facing(S.sitA, dir), ox)
      const b = draw(facing(S.sitB, dir), ox)
      const blink = draw(facing(S.sitBlink, dir), ox)

      return flip([a, b, a, b, a, b, blink, b], 3.2)
    }
  }
}

/** x du chien couché dans son panier (le panier est à droite du bandeau). */
function basketX(width: number): number {
  return Math.max(0, width - BASKET_FROM_RIGHT)
}

function sleepSpot(width: number): number {
  return clampX(basketX(width) + DOG_IN_BASKET, width)
}

function clampX(x: number, width: number, dogW = DOG_W): number {
  return Math.min(Math.max(0, x), Math.max(0, width - dogW))
}

function segments(list: Segment[]): Track {
  const kept = list.filter(s => s.dur > 0.01)
  const period = kept.reduce((sum, s) => sum + s.dur, 0)

  return { segments: kept, period }
}

/** Aller-retour sur toute la largeur, en partant d'où il est et en y revenant. */
function walkTrack(x: number, dir: DogDir, width: number, dogW = DOG_W, speed = WALK_SPEED): Track {
  const span = Math.max(0, width - dogW)
  const far = dir > 0 ? span : 0
  const near = dir > 0 ? 0 : span
  const back = (dir * -1) as DogDir

  return segments([
    { pose: 'walk', dur: Math.abs(far - x) / speed, x0: x, x1: far, dir },
    { pose: 'stand', dur: EDGE_PAUSE, x0: far, x1: far, dir },
    { pose: 'walk', dur: span / speed, x0: far, x1: near, dir: back },
    { pose: 'stand', dur: EDGE_PAUSE, x0: near, x1: near, dir: back },
    { pose: 'walk', dur: Math.abs(x - near) / speed, x0: near, x1: x, dir },
  ])
}

/** Tirage reproductible : la même graine redonne les mêmes lancers au dessin et au calcul de position. */
function rng(seed: number): () => number {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Throw = { from: number; to: number; dir: DogDir; at: number; wait: number; run: number }

/** Il lance la balle n'importe où sur le bandeau, court la chercher, la relance de là, et finit par revenir au départ. */
function ballPlan(
  x: number,
  dir: DogDir,
  width: number,
  seed: number,
  dogW = DOG_W,
  runSpeed = RUN_SPEED,
  count = THROWS,
): { track: Track; throws: Throw[] } {
  const span = Math.max(0, width - dogW)
  const rand = rng(seed)
  const stops: number[] = []
  let here = x

  for (let i = 0; i < count; i++) {
    let to = Math.round(rand() * span)

    for (let tries = 0; tries < 8 && Math.abs(to - here) < Math.min(THROW_MIN, span / 2); tries++) {
      to = Math.round(rand() * span)
    }
    stops.push(to)
    here = to
  }
  stops.push(x)

  const list: Segment[] = []
  const throws: Throw[] = []
  let from = x
  let t = 0

  for (const to of stops) {
    if (Math.abs(to - from) < 1) {
      continue
    }
    const d: DogDir = to > from ? 1 : -1
    const wait = 0.45
    const run = Math.max(Math.abs(to - from) / runSpeed, 0.4)
    const hold = 0.35
    list.push(
      { pose: 'stand', dur: wait, x0: from, x1: from, dir: d },
      { pose: 'run', dur: run, x0: from, x1: to, dir: d },
      { pose: 'carryStand', dur: hold, x0: to, x1: to, dir: d },
    )
    throws.push({ from, to, dir: d, at: t, wait, run })
    t += wait + run + hold
    from = to
  }

  return list.length === 0 ? { track: stillTrack('stand', x, dir), throws } : { track: segments(list), throws }
}

function stillTrack(pose: Pose, x: number, dir: DogDir): Track {
  return { segments: [{ pose, dur: 1, x0: x, x1: x, dir }], period: 1 }
}

const STILL_POSE: Record<Exclude<DogMode, 'walk' | 'ball'>, Pose> = {
  console: 'console',
  eat: 'eat',
  pee: 'pee',
  sleep: 'sleep',
  sit: 'sit',
}

function trackFor(mode: DogMode, start: DogPosition, width: number): Track {
  const x = clampX(start.x, width)

  if (mode === 'walk') {
    return walkTrack(x, start.dir, width)
  }

  if (mode === 'ball') {
    return ballPlan(x, start.dir, width, start.seed ?? 1).track
  }

  return stillTrack(STILL_POSE[mode], x, start.dir)
}

/** Où est le chien, et dans quel sens, `seconds` après le début de l'animation. */
export function positionAt(mode: DogMode, start: DogPosition, width: number, seconds: number): DogPosition {
  if (mode === 'sleep') {
    const { intro, target, dir } = toBasket(start, width)

    if (seconds < intro) {
      return { x: clampX(start.x, width) + (target - clampX(start.x, width)) * (seconds / intro), dir }
    }

    return { x: target, dir }
  }
  return positionOnTrack(trackFor(mode, start, width), { x: clampX(start.x, width), dir: start.dir }, seconds)
}

function positionOnTrack(track: Track, fallback: DogPosition, seconds: number): DogPosition {
  if (track.period <= 0 || track.segments.length === 0) {
    return fallback
  }
  let t = ((seconds % track.period) + track.period) % track.period

  for (const seg of track.segments) {
    if (t <= seg.dur) {
      return { x: seg.x0 + ((seg.x1 - seg.x0) * t) / seg.dur, dir: seg.dir }
    }
    t -= seg.dur
  }
  const last = track.segments[track.segments.length - 1]

  return last === undefined ? fallback : { x: last.x1, dir: last.dir }
}

const kt = (v: number) => Math.min(1, Math.max(0, v)).toFixed(4)

/** Déplace les segments (translate) et n'affiche que la pose du segment en cours. */
function animateTrack(track: Track, render: (s: Segment) => string = s => poseContent(s.pose, s.dir)): string {
  const { segments: segs, period } = track

  const first = segs[0]

  if (first === undefined) {
    return ''
  }

  if (segs.length === 1) {
    return `<g transform="translate(${first.x0} 0)">${render(first)}</g>`
  }
  const bounds = [0]
  const xs = [first.x0]
  // Chaque pose (et sens) n'est écrite qu'une fois, avec tous les moments où elle est visible.
  const groups = new Map<string, { content: string; spans: Array<[number, number]> }>()
  let t = 0

  for (const s of segs) {
    const from = t / period
    t += s.dur
    const to = Math.min(1, t / period)
    bounds.push(to)
    xs.push(s.x1)

    const key = `${s.pose}:${s.dir}`
    let group = groups.get(key)

    if (group === undefined) {
      group = { content: render(s), spans: [] }
      groups.set(key, group)
    }
    const last = group.spans[group.spans.length - 1]

    if (last !== undefined && from - last[1] < 1e-4) {
      last[1] = to
    } else {
      group.spans.push([from, to])
    }
  }
  bounds[bounds.length - 1] = 1

  let poses = ''

  for (const group of groups.values()) {
    const values = [(group.spans[0]?.[0] ?? 1) < 1e-4 ? '1' : '0']
    const times = ['0']

    for (const [a, b] of group.spans) {
      if (a >= 1e-4) {
        values.push('1')
        times.push(kt(a))
      }

      if (b < 0.9999) {
        values.push('0')
        times.push(kt(b))
      }
    }
    poses +=
      values.length === 1
        ? group.content
        : `<g opacity="${values[0]}"><animate attributeName="opacity" values="${values.join(';')}" keyTimes="${times.join(';')}" ` +
          `dur="${period.toFixed(3)}s" repeatCount="indefinite" calcMode="discrete"/>${group.content}</g>`
  }

  return (
    `<g><animateTransform attributeName="transform" type="translate" values="${xs.map(x => `${x.toFixed(1)} 0`).join(';')}" ` +
    `keyTimes="${bounds.map(kt).join(';')}" dur="${period.toFixed(3)}s" repeatCount="indefinite"/>${poses}</g>`
  )
}

/** La balle : part de la gueule, rebondit jusqu'au point de chute, disparaît quand il la ramasse, puis repart. */
function ballFlight(throws: readonly Throw[], period: number, dogW = DOG_W): string {
  if (throws.length === 0) {
    return ''
  }
  const mouth = (x: number, d: DogDir) => x + (d > 0 ? dogW - 4 : -2)
  const hold = GROUND - 16
  const top = GROUND - 24
  const ground = GROUND - 6
  const xs: Array<[number, number]> = []
  const ys: Array<[number, number]> = []
  const shown: Array<[number, number]> = []

  for (const th of throws) {
    const flight = Math.min(0.9, th.wait + th.run * 0.6)
    const pickup = th.at + th.wait + th.run
    const a = mouth(th.from, th.dir)
    const b = mouth(th.to, th.dir)
    xs.push([th.at, a], [th.at + flight, b], [pickup, b])
    ys.push(
      [th.at, hold],
      [th.at + flight * 0.3, top],
      [th.at + flight * 0.7, ground],
      [th.at + flight * 0.85, ground - 7],
      [th.at + flight, ground],
      [pickup, ground],
    )
    shown.push([th.at, 1], [pickup, 0])
  }
  // Une animation linéaire doit finir à 1 : on y répète la première valeur (la boucle).
  xs.push([period, xs[0]?.[1] ?? 0])
  ys.push([period, hold])

  const dur = `dur="${period.toFixed(3)}s" repeatCount="indefinite"`
  const anim = (name: string, keys: Array<[number, number]>, extra = '') =>
    `<animate attributeName="${name}" values="${keys.map(k => k[1]).join(';')}" ` +
    `keyTimes="${keys.map(k => kt(k[0] / period)).join(';')}" ${dur}${extra}/>`

  return (
    `<g opacity="1">${anim('opacity', shown, ' calcMode="discrete"')}` +
    `<rect width="6" height="6" fill="${COLORS.O}" stroke="${COLORS.o}" stroke-width="1" x="${xs[0]?.[1] ?? 0}" y="${hold}">` +
    `${anim('x', xs)}${anim('y', ys)}</rect></g>`
  )
}

/** Le trajet jusqu'au panier avant la sieste. */
function toBasket(start: DogPosition, width: number): { intro: number; target: number; dir: DogDir } {
  const x = clampX(start.x, width)
  const target = sleepSpot(width)
  const dir: DogDir = target > x ? 1 : target < x ? -1 : start.dir

  return { intro: Math.abs(target - x) / WALK_SPEED, target, dir }
}

/** Il marche jusqu'à son panier (une seule fois), puis s'y endort. */
function sleepScene(start: DogPosition, width: number): string {
  const x = clampX(start.x, width)
  const { intro, target, dir } = toBasket(start, width)
  const asleep = `<g transform="translate(${target} 0)">${poseContent('sleep', dir)}</g>`
  const front = draw(SPRITES.basketFront, basketX(width))

  if (intro < 0.05) {
    return asleep + front
  }
  const d = intro.toFixed(3)
  const walking =
    `<g><animate attributeName="opacity" values="1;0" keyTimes="0;1" dur="${d}s" calcMode="discrete" fill="freeze"/>` +
    `<g><animateTransform attributeName="transform" type="translate" values="${x} 0;${target} 0" dur="${d}s" fill="freeze"/>` +
    `${poseContent('walk', dir)}</g></g>`

  return walking + `<g opacity="0"><set attributeName="opacity" to="1" begin="${d}s"/>${asleep}${front}</g>`
}

/** Le décor : plancher, plante à gauche, panier à droite (derrière le chien). */
function decor(width: number): string {
  let floor =
    `<rect x="0" y="${GROUND}" width="${width}" height="${BAND_HEIGHT - GROUND}" fill="#2e2944"/>` +
    `<rect x="0" y="${GROUND}" width="${width}" height="1" fill="#4a4366"/>` +
    `<rect x="0" y="${GROUND + 2}" width="${width}" height="1" fill="#26223a"/>`

  // Joints des lames, décalés d'une rangée à l'autre.
  for (let x = 23; x < width; x += 46) {
    floor += `<rect x="${x}" y="${GROUND + 1}" width="1" height="1" fill="#1f1b2e"/>`
    floor += `<rect x="${x + 23}" y="${GROUND + 3}" width="1" height="1" fill="#1f1b2e"/>`
  }

  return floor + draw(SPRITES.plant, PLANT_X) + draw(SPRITES.basket, basketX(width))
}

// --- Les chiens des agents : chacun sa race, sa couleur et son pas ---

type BreedLook = {
  a: Sprite
  b: Sprite
  carryA: Sprite
  carryB: Sprite
  eatA: Sprite
  eatB: Sprite
  sitA: Sprite
  sitB: Sprite
  sleep: Sprite
  speed: number // px/s en balade
  run: number // px/s après la balle
  legs: number // s, cadence des pattes
}

export const HELPER_BREEDS: readonly HelperBreed[] = ['pitbull', 'berger', 'jack', 'shiba']

const S = SPRITES
const BREEDS: Record<HelperBreed, BreedLook> = {
  pitbull: {
    a: S.pitA, b: S.pitB, carryA: S.pitCarryA, carryB: S.pitCarryB, eatA: S.pitEatA, eatB: S.pitEatB,
    sitA: S.pitSitA, sitB: S.pitSitB, sleep: S.pitSleep, speed: 34, run: 90, legs: 0.55,
  },
  berger: {
    a: S.shepA, b: S.shepB, carryA: S.shepCarryA, carryB: S.shepCarryB, eatA: S.shepEatA, eatB: S.shepEatB,
    sitA: S.shepSitA, sitB: S.shepSitB, sleep: S.shepSleep, speed: 52, run: 125, legs: 0.5,
  },
  jack: {
    a: S.jackA, b: S.jackB, carryA: S.jackCarryA, carryB: S.jackCarryB, eatA: S.jackEatA, eatB: S.jackEatB,
    sitA: S.jackSitA, sitB: S.jackSitB, sleep: S.jackSleep, speed: 62, run: 140, legs: 0.3,
  },
  shiba: {
    a: S.shibaA, b: S.shibaB, carryA: S.shibaCarryA, carryB: S.shibaCarryB, eatA: S.shibaEatA, eatB: S.shibaEatB,
    sitA: S.shibaSitA, sitB: S.shibaSitB, sleep: S.shibaSleep, speed: 46, run: 115, legs: 0.42,
  },
}

const HELPER_THROWS = 4

/** La trajectoire d'un chien d'agent : les mêmes animations que le teckel (il dort sur place, sans panier). */
function helperPlan(dog: PackDog & { breed: HelperBreed }, width: number): { track: Track; throws: Throw[] } {
  const look = BREEDS[dog.breed]
  const w = spriteWidth(look.a)
  const x = clampX(dog.x, width, w)

  if (dog.mode === 'walk') {
    return { track: walkTrack(x, dog.dir, width, w, look.speed), throws: [] }
  }

  if (dog.mode === 'ball') {
    return ballPlan(x, dog.dir, width, dog.seed ?? hash(dog.id), w, look.run, HELPER_THROWS)
  }

  return { track: stillTrack(dog.mode === 'pee' ? 'stand' : STILL_POSE[dog.mode], x, dog.dir), throws: [] }
}

/** Où est le chien d'un agent `seconds` après le début de son animation. */
export function helperPositionAt(dog: PackDog & { breed: HelperBreed }, width: number, seconds: number): DogPosition {
  const w = spriteWidth(BREEDS[dog.breed].a)

  return positionOnTrack(helperPlan(dog, width).track, { x: clampX(dog.x, width, w), dir: dog.dir }, seconds)
}

/** Une pose d'un chien d'agent, dans sa robe ; vers la gauche, la même image retournée. */
function helperPose(look: BreedLook, tint: Tint | undefined, pose: Pose, dir: DogDir): string {
  const w = spriteWidth(look.a)
  const d = (sprite: Sprite, ox = 0) => draw(sprite, ox, undefined, false, tint)
  let body: string

  switch (pose) {
    case 'walk':
      body = flip([d(look.a), d(look.b)], look.legs)
      break
    case 'run':
      body = flip([d(look.a), d(look.b)], 0.24)
      break
    case 'carry':
      body = flip([d(look.carryA), d(look.carryB)], 0.24)
      break
    case 'carryStand':
      body = d(look.carryA)
      break
    case 'sit': {
      const ox = w - spriteWidth(look.sitA)
      body = flip([d(look.sitA, ox), d(look.sitB, ox)], 1.4)
      break
    }
    case 'eat':
      body = flip([d(look.eatA), d(look.eatB)], 0.8) + draw(SPRITES.bowl, w - 10)
      break
    case 'console':
      body = d(look.eatB) + draw(SPRITES.consoleDevice, w + 2, undefined, true)
      break
    case 'sleep':
      body = d(look.sleep)
      break
    default:
      body = d(look.a)
  }
  const placed = dir > 0 ? body : `<g transform="translate(${w} 0) scale(-1 1)">${body}</g>`

  return pose === 'sleep' ? placed + zzz(dir, w) : placed
}

/** Largeur du chien d'une race, pour choisir où il peut apparaître. */
export function helperWidth(breed: HelperBreed): number {
  return spriteWidth(BREEDS[breed].a)
}

// Trois robes par race : douze chiens distincts avant le premier doublon.
export const COAT_COUNT = 3

const COATS: Record<HelperBreed, readonly Tint[]> = {
  pitbull: [
    { id: 'p0', colors: {} }, // gris bleu
    { id: 'p1', colors: { A: '#c9925a', a: '#9c6a3c' } }, // fauve
    { id: 'p2', colors: { A: '#4a4560', a: '#353145' } }, // noir
  ],
  berger: [
    { id: 'b0', colors: {} }, // feu, selle sombre
    { id: 'b1', colors: { G: '#4d4760', j: '#383346', J: '#2e2a3a' } }, // noir
    { id: 'b2', colors: { G: '#f0eadc', j: '#cfc7b6', J: '#e0d9c8' } }, // blanc
  ],
  jack: [
    { id: 'j0', colors: {} }, // blanc et marron
    { id: 'j1', colors: { M: '#3a3546' } }, // blanc et noir
    { id: 'j2', colors: { M: '#e0962e' } }, // blanc et orange
  ],
  shiba: [
    { id: 's0', colors: {} }, // roux
    { id: 's1', colors: { H: '#454058', I: '#322e42', V: '#e8c9a0' } }, // noir et feu
    { id: 's2', colors: { H: '#f2e0bc', I: '#d6c096', V: '#fff7e6' } }, // crème
  ],
}

const SPAWN_SHOW = 0.45 // s : le chien apparaît au cœur de la lueur
const BARK_POSES: ReadonlySet<Pose> = new Set<Pose>(['walk', 'stand', 'sit'])

function hash(text: string): number {
  let h = 2166136261

  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  }

  return h >>> 0
}

/** « Waf ! » : une bulle près de la tête, de temps en temps (une fois toutes les 20 à 50 s, à un moment tiré au sort). */
function bark(seed: number, dir: DogDir, dogW: number): string {
  const rand = rng(seed)
  const period = 20 + rand() * 30
  const at = 0.08 + rand() * 0.8
  const end = at + 1.3 / period
  const w = 30
  const x = dir > 0 ? dogW - 6 : 6 - w
  const tail = dir > 0 ? x + 4 : x + w - 8

  return (
    `<g opacity="0"><animate attributeName="opacity" values="0;1;0" keyTimes="0;${kt(at)};${kt(end)}" ` +
    `dur="${period.toFixed(2)}s" repeatCount="indefinite" calcMode="discrete"/>` +
    `<rect x="${x}" y="-1" width="${w}" height="11" rx="2" fill="#ece8ff" stroke="${COLORS.o}" stroke-width="1"/>` +
    `<rect x="${tail}" y="10" width="4" height="2" fill="#ece8ff"/>` +
    `<text x="${x + w / 2}" y="7.5" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="8" ` +
    `font-weight="700" fill="${COLORS.o}">Waf !</text></g>`
  )
}

/** Durée du départ d'un chien dans son trou noir, en secondes. */
export const LEAVE_SECONDS = 1.6

/** Départ : un trou noir s'ouvre derrière le chien, l'aspire en le faisant tourner, puis se referme (une seule fois). */
function leavingScene(dog: PackDog & { breed: HelperBreed }, look: BreedLook, tint: Tint | undefined, width: number): string {
  const w = spriteWidth(look.a)
  const x = clampX(dog.x, width, w)
  const cx = x + w / 2
  const cy = GROUND - 13
  // Un redessin en cours de route reprend l'animation là où elle en était.
  const timing = `dur="${LEAVE_SECONDS}s" begin="${(-(dog.leaving ?? 0)).toFixed(2)}s" fill="freeze"`
  const grow = (name: string, max: number) =>
    `<animate attributeName="${name}" values="0;${max};${max};0" keyTimes="0;.25;.8;1" ${timing}/>`
  const hole =
    `<ellipse cx="${cx}" cy="${cy}" rx="0" ry="0" fill="#05040a" stroke="#b8a6ff" stroke-width="2">${grow('rx', 17)}${grow('ry', 13)}</ellipse>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="0" ry="0" fill="none" stroke="#5ec2ff" stroke-width="1" stroke-dasharray="3 4">` +
    `${grow('rx', 22)}${grow('ry', 16)}` +
    `<animateTransform attributeName="transform" type="rotate" values="0 ${cx} ${cy};720 ${cx} ${cy}" ${timing}/></ellipse>`
  const keys = 'keyTimes="0;.2;.75;1"'
  const sucked =
    `<g transform="translate(${cx} ${cy})">` +
    `<g><animateTransform attributeName="transform" type="scale" values="1;1;0;0" ${keys} ${timing}/>` +
    `<g><animateTransform attributeName="transform" type="rotate" values="0;0;540;540" ${keys} ${timing}/>` +
    `<g transform="translate(${x - cx} ${-cy})">${helperPose(look, tint, 'stand', dog.dir)}</g></g></g></g>`

  return hole + sucked
}

function helperScene(dog: PackDog & { breed: HelperBreed }, width: number): string {
  const look = BREEDS[dog.breed]
  const coats = COATS[dog.breed]
  const tint = coats[(dog.coat ?? 0) % coats.length]

  if (dog.leaving !== undefined) {
    return leavingScene(dog, look, tint, width)
  }
  const w = spriteWidth(look.a)
  const barkSeed = hash(dog.id) + dog.x * 31
  const { track, throws } = helperPlan(dog, width)
  const scene =
    animateTrack(
      track,
      s =>
        helperPose(look, tint, s.pose, s.dir) +
        (BARK_POSES.has(s.pose) && dog.mode !== 'ball' ? bark(barkSeed, s.dir, w) : ''),
    ) + ballFlight(throws, track.period, w)

  if (dog.spawn !== true) {
    return scene
  }
  const cx = clampX(dog.x, width, w) + w / 2

  return spawnGlow(cx) + `<g opacity="0"><set attributeName="opacity" to="1" begin="${SPAWN_SHOW}s"/>${scene}</g>`
}

/** Apparition : un rai de lumière, deux anneaux d'aura qui s'ouvrent et des étincelles pastel (une seule fois). */
function spawnGlow(cx: number): string {
  const cy = GROUND - 14
  const once = 'fill="freeze"'
  const beam =
    `<rect x="${cx - 4}" y="0" width="8" height="${GROUND}" fill="#d6ccff" opacity="0">` +
    `<animate attributeName="opacity" values="0;.8;.5;0" keyTimes="0;.3;.6;1" dur=".9s" ${once}/>` +
    `<animate attributeName="x" values="${cx - 1};${cx - 6};${cx - 1}" dur=".9s" ${once}/>` +
    `<animate attributeName="width" values="2;12;2" dur=".9s" ${once}/></rect>`
  const halo =
    `<rect x="${cx - 2}" y="${cy - 2}" width="4" height="4" fill="#fff6d6" opacity="0">` +
    `<animate attributeName="opacity" values="0;1;0" keyTimes="0;.4;1" dur=".7s" ${once}/></rect>`
  const rings = [0, 0.18]
    .map(
      begin =>
        `<rect x="${cx}" y="${cy}" width="0" height="0" fill="none" stroke="#b8a6ff" stroke-width="2" opacity="0">` +
        `<animate attributeName="opacity" values="0;1;0" dur=".75s" begin="${begin}s" ${once}/>` +
        `<animate attributeName="x" values="${cx};${cx - 22}" dur=".75s" begin="${begin}s" ${once}/>` +
        `<animate attributeName="y" values="${cy};${cy - 14}" dur=".75s" begin="${begin}s" ${once}/>` +
        `<animate attributeName="width" values="0;44" dur=".75s" begin="${begin}s" ${once}/>` +
        `<animate attributeName="height" values="0;28" dur=".75s" begin="${begin}s" ${once}/></rect>`,
    )
    .join('')
  const colors = ['#9ef0c9', '#ffe45c', '#5ec2ff', '#ff7a90', '#d6ccff', '#ffe45c', '#9ef0c9', '#5ec2ff']
  const sparks = colors
    .map((color, i) => {
      const angle = (i / colors.length) * Math.PI * 2
      const dx = Math.round(Math.cos(angle) * 26)
      const dy = Math.round(Math.sin(angle) * 13)

      return (
        `<rect x="${cx - 1}" y="${cy - 1}" width="2" height="2" fill="${color}" opacity="0">` +
        `<animate attributeName="opacity" values="0;1;0" dur=".8s" begin=".15s" ${once}/>` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy}" dur=".8s" begin=".15s" ${once}/></rect>`
      )
    })
    .join('')

  return beam + rings + halo + sparks
}

/**
 * Décale le départ de toutes les animations de `elapsed` secondes dans le passé.
 * L'app redessine le bandeau très souvent (à chaque image du fond) et relance alors ses
 * animations : ainsi chaque redessin reprend exactement là où on en est, au lieu de repartir de zéro.
 */
function shiftTime(svg: string, elapsed: number): string {
  if (!(elapsed > 0)) {
    return svg
  }

  return svg.replace(/<(animate|animateTransform|set)\b([^>]*?)(\/?)>/g, (_all, tag: string, attrs: string, close: string) => {
    const begin = /\sbegin="(-?[\d.]+)s"/.exec(attrs)
    const base = begin === null ? 0 : Number(begin[1])
    const rest = begin === null ? attrs : attrs.replace(begin[0], '')

    return `<${tag}${rest} begin="${(base - elapsed).toFixed(2)}s"${close}>`
  })
}

/**
 * La meute : le teckel et un chien par agent, chacun repartant de sa position.
 * `elapsed` : secondes écoulées depuis que ces positions ont été relevées.
 */
export function packSvg(dogs: readonly PackDog[], width: number, elapsed = 0): string {
  resetDefs()
  let main = ''
  let helpers = ''

  for (const dog of dogs) {
    if (dog.breed === 'teckel') {
      main = dogScene(dog.mode, dog, width)
    } else {
      helpers += helperScene({ ...dog, breed: dog.breed }, width)
    }
  }

  return shiftTime(wrap(main + helpers, width), elapsed)
}

/** Le SVG du bandeau avec le teckel seul, pour une animation qui démarre à `start`. */
export function bandSvg(mode: DogMode, start: DogPosition, width: number): string {
  resetDefs()

  return wrap(dogScene(mode, start, width), width)
}

function wrap(inner: string, width: number): string {
  const scene = decor(width) + inner

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BAND_HEIGHT}" viewBox="0 0 ${width} ${BAND_HEIGHT}" ` +
    `shape-rendering="crispEdges" style="color-scheme:light dark;background:transparent">` +
    `<defs>${defs.join('')}</defs>${scene}</svg>`
  )
}

/** Le teckel : son animation, partant de `start`. */
function dogScene(mode: DogMode, start: DogPosition, width: number): string {
  const x = clampX(start.x, width)
  const barkSeed = (start.seed ?? 1) + x * 31
  const withBark = (s: Segment) =>
    poseContent(s.pose, s.dir) + (BARK_POSES.has(s.pose) && mode !== 'ball' ? bark(barkSeed, s.dir, DOG_W) : '')
  let inner: string

  if (mode === 'ball') {
    const { track, throws } = ballPlan(x, start.dir, width, start.seed ?? 1)
    inner = animateTrack(track, withBark) + ballFlight(throws, track.period)
  } else if (mode === 'sleep') {
    inner = sleepScene({ x, dir: start.dir }, width)
  } else {
    inner = animateTrack(trackFor(mode, { x, dir: start.dir, seed: start.seed }, width), withBark)
  }

  return inner
}
