/** Ce que fait le teckel du bandeau. */
export type DogMode = 'walk' | 'console' | 'pee' | 'eat' | 'sleep' | 'ball' | 'sit' | 'pet'

/** Le sens dans lequel un chien regarde : 1 vers la droite, -1 vers la gauche. */
export type DogDir = 1 | -1

/** Les races des chiens d'agents, toutes différentes du teckel et entre elles. */
export type HelperBreed = 'pitbull' | 'berger' | 'jack' | 'shiba'

/** Un chien du bandeau : le teckel (`main`) ou celui d'un agent (son agentId), et d'où part son animation.
 * `leaving` : le chien s'en va dans un trou noir, depuis ce nombre de secondes.
 * `coat` est la robe (couleur) d'un chien d'agent ; `seed` fixe le tirage des lancers de balle ; `spawn` joue la lueur d'apparition une fois. */
export type PackDog = { id: string; breed: 'teckel' | HelperBreed; mode: DogMode; x: number; dir: DogDir; spawn?: boolean; seed?: number; coat?: number; leaving?: number }

declare module 'claude-code' {
  interface PluginState {
    'space-dog': { pack: PackDog[]; sky: number }
  }
}
