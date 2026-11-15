import { expect, mock, test } from 'claude-code/testing'

import { bandSvg, packSvg, positionAt } from './dog-svg'
import { SHOOTING_HEAD, SKY_FRAMES, skyFrame } from './sky'

const BAND = {
  plugin: 'space-dog',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('le teckel réagit à ce que fait la personne', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const alt = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const svg = await ui.find({ type: 'Svg' })
    await ui.unmount()

    return svg?.props.alt
  }

  expect(await alt()).toMatch(/se balade/)

  // « nonchalant » ne compte pas.
  await $.prompt.submit({ text: 'nonchalant ce chien', wait: false, origin: { kind: 'composer' } })
  expect(await alt()).toMatch(/se balade/)

  // Claude réfléchit : la balle, tant que la réponse n'est pas arrivée.
  await $.turn.start({} as never)
  expect(await alt()).toMatch(/balle/)
  await clock.advance(60_000)
  expect(await alt()).toMatch(/balle/)

  // Claude a répondu : assis, il attend.
  await $.turn.complete({ reason: 'answer', text: 'Voilà.' } as never)
  expect(await alt()).toMatch(/assis/)

  // Une phrase qui commence par « non » : pipi d'abord, puis la balle pendant la réflexion.
  await $.prompt.submit({ text: 'Non, pas comme ça', wait: false, origin: { kind: 'composer' } })
  expect(await alt()).toMatch(/pipi/)
  await $.turn.start({} as never)
  expect(await alt()).toMatch(/pipi/)
  await clock.advance(8_000)
  expect(await alt()).toMatch(/balle/)
  await $.turn.complete({ reason: 'answer', text: 'Pardon.' } as never)
  expect(await alt()).toMatch(/assis/)

  // Cinq minutes sans rien : la sieste.
  await clock.advance(5 * 60_000)
  expect(await alt()).toMatch(/dort/)
})

test('rien n’est dessiné dans le terminal', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>moteur</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /moteur/ }))?.text).toBe('moteur')
  await ui.unmount()
})

test('chaque animation boucle sur son point de départ', async () => {
  const width = 752

  for (const mode of ['walk', 'ball', 'sit', 'console', 'eat', 'pee', 'sleep'] as const) {
    for (const start of [{ x: 0, dir: 1 }, { x: 300, dir: -1 }, { x: 684, dir: 1 }] as const) {
      const at0 = positionAt(mode, start, width, 0)
      expect(Math.round(at0.x)).toBe(start.x)
      // Le SVG part de là où le chien est.
      expect(bandSvg(mode, start, width)).toContain(`width="${width}"`)
    }
  }

  // La balade avance à 40 px/s et revient au départ en fin de boucle.
  expect(positionAt('walk', { x: 100, dir: 1 }, width, 1).x).toBe(140)
  const period = (684 - 100) / 40 + 2 + 684 / 40 + 2 + 100 / 40
  const back = positionAt('walk', { x: 100, dir: 1 }, width, period)
  expect(Math.round(back.x)).toBe(100)

  // Au bout du bandeau, il fait demi-tour.
  expect(positionAt('walk', { x: 100, dir: 1 }, width, (684 - 100) / 40 + 3).dir).toBe(-1)
})

test('pour dormir, il va jusqu’à son panier', async () => {
  const width = 752
  const basketSpot = width - 96 + 8

  // Il part d'où il est…
  expect(positionAt('sleep', { x: 100, dir: -1 }, width, 0).x).toBe(100)
  // … marche vers le panier en se tournant vers lui…
  expect(positionAt('sleep', { x: 100, dir: -1 }, width, 1)).toEqual({ x: 140, dir: 1 })
  // … et finit couché dedans, sans en bouger.
  expect(positionAt('sleep', { x: 100, dir: -1 }, width, 600).x).toBe(basketSpot)
  // Le décor est là dans toutes les animations : plancher, Monstera, panier.
  const band = bandSvg('walk', { x: 0, dir: 1 }, width)
  expect(band).toContain('fill="#2e2944"')
  // Chaque feuille de la Monstera bouge à son propre rythme ; le plancher ne change pas d'un dessin à l'autre.
  for (const cycle of ['18.8s', '22.4s', '16.2s']) {
    expect(band).toContain(`dur="${cycle}"`)
  }
  const floor = (svg: string) => svg.slice(svg.indexOf('</defs>'), svg.indexOf('<use', svg.indexOf('</defs>')))
  expect(floor(bandSvg('sit', { x: 200, dir: 1 }, width))).toBe(floor(band))
})

test('un chien par agent, chacun d’une race différente', async ($, on) => {
  mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't' }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const alt = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const svg = await ui.find({ type: 'Svg' })
    await ui.unmount()

    return String(svg?.props.alt)
  }

  expect(await alt()).not.toMatch(/agent/)

  await $.turn.start({ agentId: 'a1', turnId: 'a1' } as never)
  await $.turn.start({ agentId: 'a2', turnId: 'a2' } as never)
  await $.turn.start({ agentId: 'a3', turnId: 'a3' } as never)
  await $.turn.start({ agentId: 'a4', turnId: 'a4' } as never)
  expect(await alt()).toMatch(/pit bull, un berger allemand, un jack russell, un shiba/)

  // Le pit bull s'en va avec son agent ; le prochain agent reprend la race libérée.
  await $.turn.complete({ agentId: 'a1', reason: 'answer', text: '' } as never)
  expect(await alt()).not.toMatch(/pit bull/)
  await $.turn.start({ agentId: 'a5', turnId: 'a5' } as never)
  expect(await alt()).toMatch(/pit bull/)

  // Les agents ne touchent pas à l'humeur du teckel.
  expect(await alt()).toMatch(/se balade/)
})

test('cinq chiens tiennent sous la limite de taille de l’app', async () => {
  const dogs = [
    { id: 'main', breed: 'teckel', mode: 'ball', x: 300, dir: 1 },
    { id: 'a', breed: 'pitbull', mode: 'walk', x: 10, dir: 1, spawn: true },
    { id: 'b', breed: 'berger', mode: 'walk', x: 200, dir: -1 },
    { id: 'c', breed: 'jack', mode: 'walk', x: 400, dir: 1 },
    { id: 'd', breed: 'shiba', mode: 'walk', x: 600, dir: -1, spawn: true },
  ] as const

  for (const mode of ['walk', 'ball', 'sit', 'console', 'eat', 'pee', 'sleep'] as const) {
    const svg = packSvg([{ ...dogs[0], mode }, ...dogs.slice(1)], 1600)
    expect(svg.length).toBeLessThan(131072)
  }
})

test('un chien apparaît dans une lueur, à un endroit au hasard', async ($, on) => {
  mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't' }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const source = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const svg = await ui.find({ type: 'Svg' })
    await ui.unmount()

    return String(svg?.props.source)
  }
  const GLOW = '#fff6d6'

  expect(await source()).not.toContain(GLOW)
  await $.turn.start({ agentId: 'a1', turnId: 'a1' } as never)
  expect(await source()).toContain(GLOW)

  // Au changement suivant, la lueur ne rejoue pas.
  await $.turn.start({ agentId: 'a2', turnId: 'a2' } as never)
  const svg = await source()
  expect(svg.split(GLOW).length - 1).toBe(1)
})

test('les chiens d’agents n’apparaissent pas tous au même endroit', async ($, on) => {
  mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  // La lueur (centrée sur le nouveau chien) se place à chaque fois ailleurs.
  const beams: string[] = []

  for (const id of ['a1', 'a2', 'a3', 'a4']) {
    await $.turn.start({ agentId: id, turnId: id } as never)
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
    await ui.unmount()
    beams.push(svg.match(/<rect x="([\d.-]+)" y="0" width="8"/)?.[1] ?? '')
  }
  expect(new Set(beams).size).toBeGreaterThan(1)
})

test('la balle est lancée au hasard sur toute la largeur', async () => {
  const width = 752
  const reach = (seed: number) => {
    const xs: number[] = []

    for (let t = 0; t < 60; t += 0.25) {
      xs.push(positionAt('ball', { x: 300, dir: 1, seed }, width, t).x)
    }

    return { min: Math.min(...xs), max: Math.max(...xs), at10: Math.round(xs[40] ?? 0) }
  }
  const a = reach(1)
  const b = reach(2)

  // Il parcourt bien plus qu'une petite zone autour de lui…
  expect(a.max - a.min).toBeGreaterThan(width / 2)
  expect(b.max - b.min).toBeGreaterThan(width / 2)
  // … les lancers changent d'une fois sur l'autre…
  expect(a.at10).not.toBe(b.at10)
  // … et l'animation part quand même de là où il est.
  expect(positionAt('ball', { x: 300, dir: 1, seed: 7 }, width, 0).x).toBe(300)
  expect(bandSvg('ball', { x: 300, dir: 1, seed: 7 }, width).length).toBeLessThan(131072)
})

test('dix agents : dix chiens tous différents, sous la limite de taille', async () => {
  const looks: Array<[string, number]> = []

  for (let coat = 0; coat < 3; coat++) {
    for (const breed of ['pitbull', 'berger', 'jack', 'shiba'] as const) {
      looks.push([breed, coat])
    }
  }
  const helpers = looks.slice(0, 10).map(([breed, coat], i) => ({
    id: `a${i}`,
    breed: breed as 'pitbull',
    coat,
    mode: 'walk' as const,
    x: i * 60,
    dir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
    spawn: i === 9,
  }))
  const svg = packSvg([{ id: 'main', breed: 'teckel', mode: 'ball', x: 300, dir: 1, seed: 3 }, ...helpers], 1600)

  expect(svg.length).toBeLessThan(131072)
  // Une robe change bien les couleurs : le pit bull fauve et le shiba noir et feu sont là.
  expect(svg).toContain('#c9925a')
  expect(svg).toContain('#454058')
  // Et les chiens aboient de temps en temps.
  expect(svg).toContain('Waf !')
})

test('chaque agent reçoit une race et une robe que personne ne porte', async ($, on) => {
  mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (let i = 0; i < 10; i++) {
    await $.turn.start({ agentId: `a${i}`, turnId: `a${i}` } as never)
  }
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
  await ui.unmount()

  // Les robes des 5e à 10e chiens sont dessinées : fauve, noir, blanc et orange, crème…
  for (const color of ['#c9925a', '#4d4760', '#3a3546', '#454058', '#4a4560', '#f0eadc']) {
    expect(svg).toContain(color)
  }
  expect(svg.length).toBeLessThan(131072)
})

test('le chien d’un agent suit l’état de son agent', async ($, on) => {
  const clock = mock.clock(on)
  let agents: Array<{ id: string; status: string }> = []
  on('agent.list', () => ({ value: agents.map(a => ({ ...a, description: 'test', type: 'general-purpose' })) }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const source = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
    await ui.unmount()

    return svg
  }
  // Signatures des poses dans le dessin : les Z du sommeil, l'écran de la console.
  const SLEEPING = 'values="0 6;'
  const SCREEN = '#3d8fd0'

  // L'agent travaille : son chien joue à la balle (la balle est dessinée).
  agents = [{ id: 'a1', status: 'running' }]
  await $.turn.start({ agentId: 'a1', turnId: 'a1' } as never)
  const playing = await source()
  expect(playing).toContain('stroke-width="1" x=')
  expect(playing).not.toContain(SLEEPING)

  // Il attend un autre agent : assis, plus de balle.
  agents = [{ id: 'a1', status: 'waiting' }]
  await clock.advance(3_000)
  const waiting = await source()
  expect(waiting).not.toContain('stroke-width="1" x=')
  expect(waiting).not.toContain(SLEEPING)

  // Inactif entre deux tours : il dort.
  agents = [{ id: 'a1', status: 'idle' }]
  await clock.advance(3_000)
  expect(await source()).toContain(SLEEPING)

  // Il reprend : la balle revient. Puis il a fini : le chien s'en va.
  agents = [{ id: 'a1', status: 'running' }]
  await clock.advance(3_000)
  expect(await source()).toContain('stroke-width="1" x=')
  expect(await source()).not.toContain(SCREEN)
  agents = [{ id: 'a1', status: 'completed' }]
  await clock.advance(3_000)
  const done = await source()
  expect(done).not.toContain('stroke-width="1" x=')
  expect(done).not.toContain(SLEEPING)
})

test('un chien qui s’en va est aspiré par un trou noir, sans redessin de plus', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't' }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const source = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
    await ui.unmount()

    return svg
  }
  const HOLE = '#05040a'

  await $.turn.start({ agentId: 'a1', turnId: 'a1' } as never)
  await $.turn.start({ agentId: 'a2', turnId: 'a2' } as never)
  expect(await source()).not.toContain(HOLE)

  // L'agent finit : son chien part dans un trou noir.
  await $.turn.complete({ agentId: 'a1', reason: 'answer', text: '' } as never)
  const leaving = await source()
  expect(leaving).toContain(HOLE)

  // Une fois le chien aspiré, la meute n'est pas republiée pour l'enlever : son départ, déjà
  // terminé, reste simplement figé sur « disparu ».
  await clock.advance(5_000)
  expect(await source()).toContain(HOLE)

  // Au changement suivant, il n'est plus là du tout.
  await $.turn.start({ agentId: 'a3', turnId: 'a3' } as never)
  expect(await source()).not.toContain(HOLE)
})

test('le fond est un film : chaque image est un SVG fixe différent', async () => {
  // Aucune animation interne (l'app les fige) : tout le mouvement vient du changement d'image.
  expect(skyFrame(0)).not.toContain('<animate')
  expect(skyFrame(0)).not.toBe(skyFrame(1))
  // Le film boucle sans couture, et une image reste légère.
  expect(skyFrame(SKY_FRAMES)).toBe(skyFrame(0))
  expect(skyFrame(3).length).toBeLessThan(20_000)
  // Une étoile filante passe au début du film, puis disparaît.
  expect(skyFrame(1)).toContain(SHOOTING_HEAD)
  expect(skyFrame(8)).not.toContain(SHOOTING_HEAD)
  // Pas d'étoiles de couleur ni d'onde radio : seulement des blancs.
  for (const color of ['#9ef0c9', '#ffe45c', '#5ec2ff', '#ff7a90', '#b8a6ff']) {
    expect(skyFrame(1)).not.toContain(color)
  }
})

test('un redessin reprend les animations là où elles en sont', async () => {
  const dogs = [
    { id: 'main', breed: 'teckel', mode: 'walk', x: 100, dir: 1 },
    { id: 'a', breed: 'shiba', coat: 0, mode: 'ball', x: 300, dir: 1, seed: 4 },
  ] as const
  const fresh = packSvg(dogs, 752)
  const later = packSvg(dogs, 752, 12.5)

  // Sans temps écoulé, rien ne change.
  expect(packSvg(dogs, 752, 0)).toBe(fresh)
  // Douze secondes et demie plus tard, chaque animation démarre 12,5 s dans le passé…
  expect(later).not.toBe(fresh)
  const tags = later.match(/<(animate|animateTransform|set)\b[^>]*>/g) ?? []
  expect(tags.length).toBeGreaterThan(5)

  for (const tag of tags) {
    const begin = /begin="(-?[\d.]+)s"/.exec(tag)
    expect(begin).not.toBeNull()
    expect(Number(begin?.[1])).toBeLessThanOrEqual(-9)
  }
  // … et le dessin lui-même est le même : seuls les départs bougent.
  expect(later.replace(/ begin="[^"]*"/g, '')).toBe(fresh.replace(/ begin="[^"]*"/g, ''))
})

test('un clic sur le teckel : il se met sur le dos pour une caresse, puis repart', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alt = async () => String((await ui.find({ type: 'Svg' }))?.props.alt)

  // Un clic loin du chien (il part de la gauche du bandeau) ne fait rien…
  await ui.pointer({ type: 'down', x: 70, y: 0, button: 'left' })
  expect(await alt()).toMatch(/se balade/)
  // … un clic sur lui le met sur le dos, cœurs compris.
  await ui.pointer({ type: 'down', x: 3, y: 0, button: 'left' })
  expect(await alt()).toMatch(/sur le dos/)
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('#ff8fb3')
  // La caresse finie, il reprend sa balade.
  await clock.advance(6_000)
  expect(await alt()).toMatch(/se balade/)
  await ui.unmount()
})

test('la gamelle d’eau est posée près du panier', async () => {
  const band = bandSvg('walk', { x: 0, dir: 1 }, 752)
  expect(band).toContain('#5ec2ff')
  expect(band).toContain('#7fa8e8')
})

test('un clic sur un chien d’agent : lui aussi se met sur le dos, puis reprend ce que fait son agent', async ($, on) => {
  const clock = mock.clock(on)
  on('agent.list', () => ({ value: [{ id: 'a1', status: 'running', description: 'test', type: 'general-purpose' }] }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ agentId: 'a1', turnId: 'a1' } as never)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alt = async () => String((await ui.find({ type: 'Svg' }))?.props.alt)
  const helperOnBack = /(pit bull|berger allemand|jack russell|shiba) sur le dos/
  expect(await alt()).not.toMatch(/sur le dos/)

  // Le chien de l'agent apparaît au hasard : on clique de colonne en colonne, de droite à gauche,
  // jusqu'à tomber dessus (s'il est caché derrière le teckel, le teckel a droit à sa caresse en passant).
  for (let x = 85; x >= 0 && !helperOnBack.test(await alt()); x -= 1) {
    await ui.pointer({ type: 'down', x, y: 0, button: 'left' })
  }
  expect(await alt()).toMatch(helperOnBack)

  // Le relevé des agents ne l'interrompt pas…
  await clock.advance(3_100)
  expect(await alt()).toMatch(helperOnBack)
  // … et la caresse finie, il retourne à sa balle.
  await clock.advance(3_000)
  expect(await alt()).not.toMatch(helperOnBack)
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('stroke-width="1" x=')
  await ui.unmount()
})
