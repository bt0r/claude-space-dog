# claude-space-dog

Un mod Claude Code pour l'app desktop : un thème sombre aux accents pastel, un ciel étoilé animé derrière la conversation, et un teckel en pixel art qui vit au-dessus de la zone de saisie.

## Ce que fait le mod

**Le thème**
- Couleurs sombres « nuit indigo », accents pastel (lavande, menthe, citron, bleu ciel, corail).
- En fond, une nuit étoilée traversée par la Voie lactée, avec des étoiles qui scintillent et des étoiles filantes.

**Le teckel**, dans un bandeau au-dessus de la saisie, réagit à ce qui se passe :

| Quand… | le teckel… |
|---|---|
| rien ne se passe | se balade d'un bout à l'autre du bandeau |
| tu tapes un message | regarde sa console |
| ton message commence par « non » | fait pipi contre une borne à incendie |
| Claude réfléchit | joue à la balle, lancée au hasard sur toute la largeur |
| Claude a répondu | s'assoit et attend |
| tu ne fais rien depuis un moment | mange dans sa gamelle |
| tu ne fais rien depuis 5 minutes | va dormir dans son panier |

Il aboie « Waf ! » de temps en temps. Le bandeau a un plancher, une plante et le panier.

**Un chien par agent.** Chaque agent lancé fait apparaître un chien dans une lueur, à un endroit au hasard : pit bull, berger allemand, jack russell ou shiba, chacun en trois robes, soit 12 chiens différents avant le premier doublon. Le chien suit l'état de son agent (balle quand il travaille, console pendant un outil long, assis quand il attend, couché quand il est inactif) et repart aspiré par un trou noir quand l'agent a fini.

## Installation

Il faut l'app desktop de Claude, avec Claude Code 2.1.323 ou plus récent. Le terminal n'affiche ni le fond, ni le bandeau, ni les couleurs.

Dans une session de terminal, à l'invite de Claude Code :

```
/plugin install ondes-pastel --marketplace bt0r/claude-space-dog
```

Réponds `y` pour ajouter la marketplace, puis choisis la portée « user » pour l'avoir dans toutes tes sessions.

Depuis un shell :

```bash
claude plugin install ondes-pastel --marketplace bt0r/claude-space-dog
```

Dans l'app desktop, où `/plugin` ne fonctionne pas : clique sur **+** à côté de la zone de saisie, puis **Plugins**, **Add marketplace** avec `bt0r/claude-space-dog`, puis **Add plugin**.

Une fois installé, les nouvelles sessions chargent le mod au démarrage. Dans une session déjà ouverte, tape `/reload-plugins`.

## Développer

- `hooks/register.tsx` : le point d'entrée du mod (thème, humeurs du teckel, chiens des agents, horloge du fond).
- `hooks/dog-svg.ts` : compose les animations du bandeau en SVG.
- `hooks/sky.ts` : dessine le fond image par image.
- `hooks/sprites.ts` : les sprites, générés par `gen_band.py` (`python3 gen_band.py hooks/sprites.ts`).
- `hooks/dog.test.tsx` : les tests, lancés par `claude plugin test .`.

Pour essayer une modification sans réinstaller : `claude --plugin-dir .`, ou `/reload-plugins` si le mod est installé depuis ce dossier.
