import { atom, read, update } from 'claude-code'
import type { AgentInfo, AgentStatus, EngineInterface, Register, ThemeSetArgs, Timer } from 'claude-code'

import type { DogMode, HelperBreed, PackDog } from '../types'
import {
  BAND_HEIGHT,
  DOG_W,
  COAT_COUNT,
  HELPER_BREEDS,
  LEAVE_SECONDS,
  helperPositionAt,
  helperWidth,
  packSvg,
  positionAt,
} from './dog-svg'
import { problems, theme } from './palette'
import { SKY_FPS, SKY_FRAMES, skyFrame } from './sky'

const LOOK: ThemeSetArgs = {
  colors: theme,
  // Un verre léger : assez pour lire le texte, pas au point de cacher le fond animé.
  backdrop: { scene: 'space-dog', glass: { blur: 5, tint: '#12111f', opacity: 0.55 } },
}

const MAIN = 'main'
const MAIN_DOG: PackDog = { id: MAIN, breed: 'teckel', mode: 'walk', x: 0, dir: 1 }

/** Le numéro de l'image du fond ; le fond se redessine à chaque changement. */
const sky = atom({ plugin: 'space-dog', key: 'sky' } as const, 0)

/** Les chiens du bandeau et d'où part l'animation de chacun ; le bandeau se redessine à chaque changement. */
const pack = atom({ plugin: 'space-dog', key: 'pack' } as const, [MAIN_DOG] as PackDog[])

const SLEEP_AFTER_MS = 5 * 60_000 // dort après 5 min sans rien faire
const TYPING_PAUSE_MS = 4_000 // range la console 4 s après la dernière frappe
const EAT_MIN_MS = 40_000 // mange au hasard entre 40 s…
const EAT_MAX_MS = 120_000 // … et 2 min d'inactivité
const HELPER_MAX_MS = 30 * 60_000 // un chien d'agent part de lui-même au bout de 30 min
const POLL_MS = 3_000 // relit l'état des agents tant qu'il y a des chiens d'agents
const LONG_TOOL_MS = 1_500 // un outil plus long que ça : le chien sort sa console
// Animations ponctuelles ; les autres durent jusqu'au prochain événement.
const DURATION_MS: Partial<Record<DogMode, number>> = { pee: 7_000, eat: 8_000, pet: 5_000 }
const PET_MARGIN = 10 // px : un clic tout près du teckel compte aussi

// Largeur du bandeau en pixels : l'app ne lit pas une largeur en %. Elle donne au bandeau
// ses colonnes moins les 5 de son bouton ; mesuré sur l'app : 85 colonnes ↔ 752 px.
const PX_PER_COLUMN = 8.36
const ENGINE_COLUMNS = 5
const MIN_BAND_WIDTH = 300

/** Une phrase qui commence par « non » : « non », « Non, … », « non. ». */
const STARTS_WITH_NON = /^\s*non(?![\p{L}\p{N}])/iu

const ALT: Record<DogMode, string> = {
  walk: 'Un teckel noir en pixel art se balade',
  console: 'Le teckel regarde sa console',
  pee: 'Le teckel fait pipi contre une borne à incendie',
  eat: 'Le teckel mange dans sa gamelle',
  sleep: 'Le teckel dort dans son panier',
  ball: 'Le teckel joue avec sa balle pendant que Claude réfléchit',
  sit: 'Le teckel est assis et attend',
  pet: 'Le teckel se roule sur le dos et se dandine pour une caresse',
}

const BREED_NAME: Record<HelperBreed, string> = {
  pitbull: 'un pit bull',
  berger: 'un berger allemand',
  jack: 'un jack russell',
  shiba: 'un shiba',
}

// La meute (repart de zéro à chaque rechargement du mod) : chaque chien et l'instant
// où son animation a démarré.
type Running = { dog: PackDog; at: number; leftAt?: number }
const dogs = new Map<string, Running>([[MAIN, { dog: MAIN_DOG, at: 0 }]])
const helperTimers = new Map<string, Timer>()
const listed = new Set<string>() // agents vus dans la liste de l'app
let pollTimer: Timer | undefined
let skyTimer: Timer | undefined
let bandWidth = 700 // px, dernière largeur dessinée
let basedAt = 0 // ms : l'instant où les positions de la meute ont été relevées
let backToRest: Timer | undefined
let eatTimer: Timer | undefined
let sleepTimer: Timer | undefined
let working = false // Claude est en train de répondre
// Les chiens d'agents qu'on caresse : ce que leur agent leur demandera de faire après la caresse.
const petted = new Map<string, { after: DogMode; timer?: Timer }>()

function mainMode(): DogMode {
  return dogs.get(MAIN)?.dog.mode ?? 'walk'
}

/** Fige chaque chien là où il en est : toutes les animations repartent de maintenant. */
function rebase(now: number): void {
  basedAt = now
  for (const [id, { dog, at, leftAt }] of dogs) {
    // Un chien qui s'en va reste où il est ; une fois aspiré, il disparaît de la meute.
    if (leftAt !== undefined) {
      const gone = (now - leftAt) / 1000

      if (gone >= LEAVE_SECONDS) {
        dogs.delete(id)
      } else {
        dogs.set(id, { dog: { ...dog, leaving: gone }, at, leftAt })
      }
      continue
    }
    const seconds = (now - at) / 1000
    const here =
      dog.breed === 'teckel'
        ? positionAt(dog.mode, dog, bandWidth, seconds)
        : helperPositionAt({ ...dog, breed: dog.breed }, bandWidth, seconds)
    // L'effet d'apparition ne se joue qu'une fois : il est retiré au premier changement suivant.
    const { spawn: _spawned, ...rest } = dog
    dogs.set(id, { dog: { ...rest, x: Math.round(here.x), dir: here.dir }, at: now })
  }
}

async function publish($: EngineInterface): Promise<void> {
  const list = [...dogs.values()].map(r => r.dog)
  await update($, pack, () => list)
}

/** Change l'animation du teckel en partant de l'endroit exact où il se trouve. */
async function setMode($: EngineInterface, next: DogMode): Promise<void> {
  backToRest?.cancel()
  backToRest = undefined

  const now = await $.clock.now()
  rebase(now)
  const main = dogs.get(MAIN) ?? { dog: MAIN_DOG, at: now }
  // Une nouvelle graine à chaque changement : les lancers de balle ne se répètent pas d'une fois sur l'autre.
  dogs.set(MAIN, { dog: { ...main.dog, mode: next, seed: Math.floor(Math.random() * 1e9) }, at: now })
  await publish($)

  const ms = DURATION_MS[next]

  if (ms !== undefined) {
    backToRest = $.clock.after(ms, () => void setMode($, resting()))
  }
}

/** Une race et une robe que personne ne porte : d'abord les quatre races, puis leurs autres robes. */
function freeLook(): { breed: HelperBreed; coat: number } {
  const taken = new Set(
    [...dogs.values()].filter(r => r.leftAt === undefined).map(r => `${r.dog.breed}:${r.dog.coat ?? 0}`),
  )

  for (let coat = 0; coat < COAT_COUNT; coat++) {
    for (const breed of HELPER_BREEDS) {
      if (!taken.has(`${breed}:${coat}`)) {
        return { breed, coat }
      }
    }
  }
  // Plus de douze agents : on retire au sort.
  const breed = HELPER_BREEDS[Math.floor(Math.random() * HELPER_BREEDS.length)] ?? 'jack'

  return { breed, coat: Math.floor(Math.random() * COAT_COUNT) }
}

/** Un nouveau chien, d'une race et d'une robe libres, apparaît dans une lueur, n'importe où. */
function spawnDog($: EngineInterface, agentId: string, mode: DogMode, now: number): void {
  const { breed, coat } = freeLook()
  const x = Math.round(Math.random() * Math.max(0, bandWidth - helperWidth(breed)))
  const dir = Math.random() < 0.5 ? 1 : -1
  const seed = Math.floor(Math.random() * 1e9)
  dogs.set(agentId, { dog: { id: agentId, breed, coat, mode, x, dir, seed, spawn: true }, at: now })
  helperTimers.set(agentId, $.clock.after(HELPER_MAX_MS, () => void removeHelper($, agentId)))
}

/** Le chien de cet agent est-il là, et pas en train de partir ? */
function alive(agentId: string): boolean {
  const running = dogs.get(agentId)

  return running !== undefined && running.leftAt === undefined
}

/** Le chien s'en va dans un trou noir ; il est retiré de la meute une fois aspiré (après un rebase). */
function dropDog($: EngineInterface, agentId: string, now: number): void {
  helperTimers.get(agentId)?.cancel()
  helperTimers.delete(agentId)
  listed.delete(agentId)
  const running = dogs.get(agentId)

  if (running === undefined || running.leftAt !== undefined) {
    return
  }
  const { spawn: _spawned, ...dog } = running.dog
  dogs.set(agentId, { dog: { ...dog, leaving: 0 }, at: now, leftAt: now })
  // Le dessin en cours le montre déjà disparu : on l'oublie sans redessiner (pas de clignotement).
  $.clock.after(LEAVE_SECONDS * 1000 + 200, () => {
    if (dogs.get(agentId)?.leftAt === now) {
      dogs.delete(agentId)
    }
  })
}

/** Relit l'état des agents à intervalle régulier, tant qu'il y a des chiens d'agents. */
function ensurePoll($: EngineInterface): void {
  if (pollTimer !== undefined) {
    return
  }
  pollTimer = $.clock.every(POLL_MS, () => {
    if ([...dogs.keys()].some(id => id !== MAIN && alive(id))) {
      void sync($)
    }
  })
}

/** Un agent travaille : son chien apparaît s'il n'est pas là, et joue à la balle. */
async function addHelper($: EngineInterface, agentId: string): Promise<void> {
  ensurePoll($)
  const current = dogs.get(agentId)

  if (current !== undefined && alive(agentId)) {
    if (current.dog.mode !== 'ball' && current.dog.mode !== 'console') {
      await setHelperMode($, agentId, 'ball')
    }

    return
  }
  const now = await $.clock.now()
  rebase(now)
  dogs.delete(agentId)
  spawnDog($, agentId, 'ball', now)
  await publish($)
}

/** Change l'animation d'un chien d'agent, en partant de là où il est. */
async function setHelperMode($: EngineInterface, agentId: string, mode: DogMode): Promise<void> {
  const pet = petted.get(agentId)

  // Pendant une caresse, le chien reste sur le dos : il fera ce que veut son agent après.
  if (pet !== undefined) {
    pet.after = mode

    return
  }

  if (!alive(agentId) || dogs.get(agentId)?.dog.mode === mode) {
    return
  }
  const now = await $.clock.now()
  rebase(now)
  const current = dogs.get(agentId)

  if (current === undefined || !alive(agentId)) {
    return
  }
  dogs.set(agentId, { dog: { ...current.dog, mode, seed: Math.floor(Math.random() * 1e9) }, at: now })
  await publish($)
}

/** L'agent a fini : son chien s'en va. */
async function removeHelper($: EngineInterface, agentId: string): Promise<void> {
  if (!alive(agentId)) {
    return
  }
  const now = await $.clock.now()
  rebase(now)
  dropDog($, agentId, now)
  await publish($)
}

/**
 * L'animation d'un chien selon l'état de son agent :
 * pas encore démarré → il se balade ; en cours → balle (console pendant un outil long) ;
 * en attente d'un autre agent ou d'une tâche de fond → assis ; inactif entre deux tours → il dort ;
 * terminé → il s'en va (undefined).
 */
function modeFor(status: AgentStatus, current: DogMode | undefined): DogMode | undefined {
  switch (status) {
    case 'pending':
      return 'walk'
    case 'running':
      return current === 'console' ? 'console' : 'ball'
    case 'waiting':
      return 'sit'
    case 'idle':
      return 'sleep'
    default:
      return undefined
  }
}

/**
 * Aligne les chiens sur la liste des agents de l'app. Répond false quand l'app ne donne pas
 * cette liste : on s'en tient alors aux débuts et fins de tour.
 */
async function sync($: EngineInterface, endedId?: string): Promise<boolean> {
  let agents: AgentInfo[]

  try {
    agents = await $.agent.list()
  } catch {
    return false
  }
  const now = await $.clock.now()
  let changed = false
  const touch = () => {
    if (!changed) {
      rebase(now)
      changed = true
    }
  }
  const seen = new Set<string>()

  for (const agent of agents) {
    seen.add(agent.id)
    const mode = modeFor(agent.status, dogs.get(agent.id)?.dog.mode)

    if (mode === undefined) {
      if (alive(agent.id)) {
        touch()
        dropDog($, agent.id, now)
      }
      continue
    }
    listed.add(agent.id)

    if (!alive(agent.id)) {
      touch()
      dogs.delete(agent.id)
      spawnDog($, agent.id, mode, now)
    } else if (petted.has(agent.id)) {
      const pet = petted.get(agent.id)

      if (pet !== undefined) {
        pet.after = mode
      }
    } else if (dogs.get(agent.id)?.dog.mode !== mode) {
      touch()
      const current = dogs.get(agent.id)

      if (current !== undefined) {
        dogs.set(agent.id, { dog: { ...current.dog, mode, seed: Math.floor(Math.random() * 1e9) }, at: now })
      }
    }
  }

  // Un agent que l'app ne liste plus (ou jamais, et dont le tour vient de finir) : son chien s'en va.
  for (const id of [...dogs.keys()]) {
    if (id !== MAIN && alive(id) && !seen.has(id) && (listed.has(id) || id === endedId)) {
      touch()
      dropDog($, id, now)
    }
  }

  if (changed) {
    await publish($)
  }

  return true
}

/** Ce que fait le teckel quand rien de ponctuel n'est en cours. */
function resting(): DogMode {
  return working ? 'ball' : 'walk'
}

function scheduleEat($: EngineInterface): void {
  const wait = EAT_MIN_MS + Math.random() * (EAT_MAX_MS - EAT_MIN_MS)
  eatTimer = $.clock.after(wait, () => {
    if (!working && (mainMode() === 'walk' || mainMode() === 'sit')) {
      void setMode($, 'eat')
    }
    scheduleEat($)
  })
}

// Inactivité : un repas au hasard, puis la sieste au bout de 5 min.
function armIdle($: EngineInterface): void {
  eatTimer?.cancel()
  sleepTimer?.cancel()
  scheduleEat($)
  sleepTimer = $.clock.after(SLEEP_AFTER_MS, () => {
    if (working) {
      return
    }
    eatTimer?.cancel()
    void setMode($, 'sleep')
  })
}

// Toute activité réveille le teckel et relance le compte à rebours.
async function activity($: EngineInterface): Promise<void> {
  armIdle($)

  if (mainMode() === 'sleep' || mainMode() === 'eat') {
    await setMode($, resting())
  }
}

// Console tant que la saisie bouge, rangée après une courte pause.
async function typing($: EngineInterface, text: string): Promise<void> {
  armIdle($)

  if (text.trim() === '') {
    if (mainMode() === 'console') {
      await setMode($, 'walk')
    }

    return
  }

  if (mainMode() === 'pee' || working) {
    return
  }

  if (mainMode() !== 'console') {
    await setMode($, 'console')
  }
  backToRest?.cancel()
  backToRest = $.clock.after(TYPING_PAUSE_MS, () => void setMode($, 'walk'))
}

function describe(list: readonly PackDog[]): string {
  const main = list.find(d => d.breed === 'teckel')
  const others = list.flatMap(d =>
    d.breed === 'teckel' || d.leaving !== undefined ? [] : [`${BREED_NAME[d.breed]}${d.mode === 'pet' ? ' sur le dos' : ''}`],
  )
  const base = ALT[main?.mode ?? 'walk']

  return others.length === 0 ? base : `${base}, avec ${others.join(', ')} (un chien par agent)`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(LOOK)

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }
    // Les agents d'avant le rechargement sont partis : seul le teckel reste.
    const now = await $.clock.now()
    const saved = (await read($, pack)).find(d => d.id === MAIN) ?? MAIN_DOG
    dogs.clear()
    listed.clear()
    basedAt = now
    dogs.set(MAIN, { dog: saved, at: now })
    await publish($)
    armIdle($)
    pollTimer?.cancel()
    pollTimer = undefined
    ensurePoll($)
    // L'app fige les animations internes du fond : le mod avance le film lui-même.
    skyTimer?.cancel()
    skyTimer = $.clock.every(1000 / SKY_FPS, () => void update($, sky, n => (n + 1) % SKY_FRAMES))

    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const result = await next(e)
    await typing($, result.text)

    return result
  })

  on('prompt.change', async ($, e, next) => {
    await typing($, e.text)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    armIdle($)
    await setMode($, STARTS_WITH_NON.test(e.text) ? 'pee' : 'walk')

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await activity($)
    const id = e.agentId

    if (id === undefined || !alive(id)) {
      return next(e)
    }
    // Un outil qui dure : le chien de l'agent sort sa console, puis reprend sa balle.
    const long = $.clock.after(LONG_TOOL_MS, () => void setHelperMode($, id, 'console'))

    try {
      return await next(e)
    } finally {
      long.cancel()

      if (dogs.get(id)?.dog.mode === 'console') {
        await setHelperMode($, id, 'ball')
      }
    }
  })

  // Claude réfléchit : le teckel joue avec sa balle (après un éventuel pipi).
  // Un agent démarre : un nouveau chien arrive.
  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) {
      await addHelper($, e.agentId)

      return next(e)
    }
    working = true
    armIdle($)

    if (mainMode() !== 'pee') {
      await setMode($, 'ball')
    }

    return next(e)
  })

  // Claude a répondu : le teckel s'assoit et attend. Un tour d'agent finit : son chien suit l'état de l'agent.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId

      try {
        return await next(e)
      } finally {
        // L'app dit où en est l'agent (en attente, inactif, terminé) ; sinon, fin de tour = départ.
        if (!(await sync($, id))) {
          await removeHelper($, id)
        }
      }
    }
    working = false
    armIdle($)
    await setMode($, e.reason === 'answer' ? 'sit' : 'walk')

    return next(e)
  })

  // Fond : nuit étoilée, Voie lactée et étoiles filantes, une image fixe par pas d'horloge.
  // En image (sans isInteractive) : un cadre serait rechargé à chaque image et clignoterait.
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    // Ce hook entend le fond de tous les mods : on ne dessine que le nôtre.
    const mine = e.props.plugin === $.plugin.name && e.props.scene === 'space-dog'

    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || !mine) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)
    const frame = await read($, sky)

    return <Svg source={skyFrame(frame)} alt="Nuit étoilée en pixel art, traversée par la Voie lactée et des étoiles filantes" />
  })

  // Bandeau au-dessus de la saisie : la meute, en image à la largeur du bandeau en pixels.
  // Pas de cadre (isInteractive) : l'app le rechargeait à chaque changement, ce qui faisait clignoter le bandeau.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Svg } = $.ui.resolve(e)
    const list = await read($, pack)
    const width = Math.max(MIN_BAND_WIDTH, Math.round((e.props.bodyColumns + ENGINE_COLUMNS) * PX_PER_COLUMN))
    bandWidth = width
    // L'app redessine le bandeau à chaque image du fond et relance ses animations : on suit
    // l'horloge du fond et on reprend chaque animation à l'instant où elle en est.
    await read($, sky)
    const elapsed = Math.max(0, ((await $.clock.now()) - basedAt) / 1000)

    // Sur le bureau, une zone transparente par-dessus le dessin reçoit les clics (la caresse).
    let petting = null

    if (e.surface === 'desktop') {
      const { Client } = $.ui.resolve(e)
      petting = (
        <Box position="absolute" top={0} left={0} width="100%" height="100%">
          <Client key="petting" module="./petting.ts" width="100%" height="100%" />
        </Box>
      )
    }

    return (
      <Box width="100%" position="relative">
        <Svg source={packSvg(list, width, elapsed)} alt={describe(list)} width={width} height={BAND_HEIGHT} />
        {petting}
      </Box>
    )
  })

  // Un clic sur le teckel : il se met sur le dos et se dandine, le temps d'une caresse.
  on('ui.message', { element: 'petting' }, async ($, e, next) => {
    const data = e.data as { x?: unknown } | null

    if (typeof data?.x !== 'number') {
      return next(e)
    }
    const id = await dogUnder($, data.x * PX_PER_COLUMN)

    if (id === MAIN) {
      armIdle($)
      await setMode($, 'pet')
    } else if (id !== undefined) {
      await petHelper($, id)
    }

    return next(e)
  })
}

/**
 * Le chien sous le clic (en pixels du bandeau), là où il est en ce moment : d'abord les chiens
 * d'agents, dessinés par-dessus le teckel, le dernier arrivé en premier ; un chien qui s'en va ne compte pas.
 */
async function dogUnder($: EngineInterface, px: number): Promise<string | undefined> {
  const now = await $.clock.now()
  const order = [...dogs.entries()].filter(([id]) => id !== MAIN).reverse()
  const main = dogs.get(MAIN)

  if (main !== undefined) {
    order.push([MAIN, main])
  }

  for (const [id, { dog, at, leftAt }] of order) {
    if (leftAt !== undefined) {
      continue
    }
    const seconds = (now - at) / 1000
    const here =
      dog.breed === 'teckel'
        ? { x: positionAt(dog.mode, dog, bandWidth, seconds).x, w: DOG_W }
        : { x: helperPositionAt({ ...dog, breed: dog.breed }, bandWidth, seconds).x, w: helperWidth(dog.breed) }

    if (px >= here.x - PET_MARGIN && px <= here.x + here.w + PET_MARGIN) {
      return id
    }
  }

  return undefined
}

/** La caresse d'un chien d'agent : sur le dos le temps d'une caresse, puis il reprend ce que fait son agent. */
async function petHelper($: EngineInterface, agentId: string): Promise<void> {
  const current = dogs.get(agentId)

  if (current === undefined || !alive(agentId)) {
    return
  }
  const previous = petted.get(agentId)
  previous?.timer?.cancel()
  // Ce que son agent lui fait faire, mis à jour pendant la caresse ; il le reprend à la fin.
  const entry: { after: DogMode; timer?: Timer } = { after: previous?.after ?? current.dog.mode }
  petted.set(agentId, entry)
  entry.timer = $.clock.after(DURATION_MS.pet ?? 5_000, () => {
    petted.delete(agentId)
    void setHelperMode($, agentId, entry.after)
  })
  const now = await $.clock.now()
  rebase(now)
  const here = dogs.get(agentId)

  if (here !== undefined) {
    dogs.set(agentId, { dog: { ...here.dog, mode: 'pet' }, at: now })
    await publish($)
  }
}
