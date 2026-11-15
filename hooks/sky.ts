// Le fond : une nuit étoilée en pixel art, traversée par la Voie lactée, dessinée image par image.
//
// L'app fige les animations internes d'un SVG posé en fond (SMIL comme CSS), mais elle
// affiche bien un nouveau SVG quand le mod en donne un. Le mod joue donc l'animation
// lui-même : une horloge avance un compteur d'images, et chaque image est un SVG fixe.

/** Images par seconde du fond. L'app accepte au plus 10 redessins par seconde. */
export const SKY_FPS = 4
/** Le film boucle après ce nombre d'images (60 s à 4 images par seconde). */
export const SKY_FRAMES = 240

const W = 1600
const H = 900
// Des blancs, du plus froid au plus chaud : pas d'étoiles de couleur.
const STAR_COLORS = ['#ffffff', '#f4f1ff', '#e6e9ff', '#fff6e6', '#dfe4f5']
/** Le scintillement d'une étoile, une valeur par image. */
const TWINKLE = [1, 1, 0.6, 0.6, 0.15, 0.15, 0.6, 0.6, 1, 1, 1, 1]

type Star = { x: number; y: number; size: number; color: string; phase: number; slow: number }

/** Tirage reproductible : les étoiles sont toujours aux mêmes endroits. */
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

function makeStars(): Star[] {
  const rand = rng(7)
  const stars: Star[] = []

  for (let i = 0; i < 70; i++) {
    stars.push({
      x: Math.floor((rand() * W) / 4) * 4,
      y: Math.floor((rand() * H) / 4) * 4,
      size: [4, 6, 6, 8][Math.floor(rand() * 4)] ?? 6,
      color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)] ?? '#ece8ff',
      phase: Math.floor(rand() * TWINKLE.length),
      slow: 1 + Math.floor(rand() * 3), // certaines scintillent plus lentement
    })
  }

  return stars
}

const STARS = makeStars()

/**
 * La Voie lactée : une bande diagonale, faite d'une lueur diffuse et de deux nuages de
 * minuscules étoiles (un cœur dense, un halo plus large). Elle ne bouge pas : calculée une fois.
 */
function makeMilkyWay(): string {
  const rand = rng(21)
  const angle = (-24 * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  // Une somme de tirages : beaucoup de points près de l'axe de la bande, peu sur ses bords.
  const spread = () => (rand() + rand() + rand()) / 1.5 - 1

  const cloud = (count: number, halfWidth: number) => {
    let d = ''

    for (let i = 0; i < count; i++) {
      const along = (rand() - 0.5) * 2100
      // La bande s'élargit vers son centre, comme le bulbe de la galaxie.
      const bulge = 1 + 0.7 * Math.exp(-((along / 420) ** 2))
      const across = spread() * halfWidth * bulge
      const x = Math.round((W / 2 + along * cos - across * sin) / 2) * 2
      const y = Math.round((H / 2 + along * sin + across * cos) / 2) * 2

      if (x < 0 || x > W || y < 0 || y > H) {
        continue
      }
      const size = rand() < 0.2 ? 4 : 2
      d += `M${x} ${y}h${size}v${size}h-${size}z`
    }

    return d
  }
  const glow =
    `<rect x="-300" y="${H / 2 - 150}" width="${W + 600}" height="300" fill="url(#mw)" ` +
    `transform="rotate(-24 ${W / 2} ${H / 2})"/>`

  return (
    glow +
    `<path fill="#dfe4f5" opacity=".16" d="${cloud(230, 190)}"/>` +
    `<path fill="#f4f1ff" opacity=".34" d="${cloud(300, 80)}"/>`
  )
}

const MILKY_WAY = makeMilkyWay()

/** Les étoiles filantes : chacune traverse le ciel en diagonale pendant une seconde et demie, puis attend. */
const SHOOTERS = [
  { x: 200, y: 60, every: 28, at: 0 },
  { x: 900, y: 140, every: 36, at: 12 },
  { x: 500, y: 30, every: 44, at: 24 },
]
const SHOOT_FRAMES = 6
/** La tête d'une étoile filante, d'un blanc à elle (les tests la repèrent ainsi). */
export const SHOOTING_HEAD = '#fffdf5'

function shooting(frame: number): string {
  let out = ''

  for (const s of SHOOTERS) {
    const t = (frame + s.every - s.at) % s.every

    if (t >= SHOOT_FRAMES) {
      continue
    }
    const x = s.x + (520 * t) / SHOOT_FRAMES
    const y = s.y + (190 * t) / SHOOT_FRAMES
    out +=
      `<rect x="${x}" y="${y}" width="10" height="10" fill="${SHOOTING_HEAD}"/>` +
      `<rect x="${x - 16}" y="${y - 6}" width="12" height="6" fill="#f4f1ff" opacity=".8"/>` +
      `<rect x="${x - 34}" y="${y - 12}" width="14" height="4" fill="#e6e9ff" opacity=".55"/>` +
      `<rect x="${x - 54}" y="${y - 18}" width="16" height="2" fill="#dfe4f5" opacity=".3"/>`
  }

  return out
}

/** L'image numéro `frame` du fond, en SVG fixe. */
export function skyFrame(frame: number): string {
  const f = ((Math.floor(frame) % SKY_FRAMES) + SKY_FRAMES) % SKY_FRAMES
  let stars = ''

  for (const star of STARS) {
    const opacity = TWINKLE[(Math.floor(f / star.slow) + star.phase) % TWINKLE.length] ?? 1
    stars += `<rect x="${star.x}" y="${star.y}" width="${star.size}" height="${star.size}" fill="${star.color}" opacity="${opacity}"/>`
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${W} ${H}" ` +
    `preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#100f1d"/><stop offset=".7" stop-color="#16142a"/><stop offset="1" stop-color="#211c3d"/>` +
    `</linearGradient>` +
    `<linearGradient id="mw" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#cfd4f2" stop-opacity="0"/><stop offset=".5" stop-color="#cfd4f2" stop-opacity=".13"/>` +
    `<stop offset="1" stop-color="#cfd4f2" stop-opacity="0"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>${MILKY_WAY}${stars}${shooting(f)}</svg>`
  )
}
