import { makeColors } from './make-colors.js'

// Nuit indigo, accents pastel : lavande (accent), rouge corail vif (danger), menthe (succès),
// jaune citron vif (avertissement), bleu ciel vif (pro). Pensé pour le sombre uniquement.
export const { theme, problems } = makeColors({
  label: 'Ondes pastel',
  only: 'dark',
  roles: { accent: '#b8a6ff', danger: '#ff7a90', success: '#9ef0c9', warning: '#ffe45c', pro: '#5ec2ff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#12111f',
        'surface-1': '#181729',
        'surface-2': '#1d1b31',
        'surface-3': '#222038',
        'text-primary': '#ece8ff',
        'text-secondary': '#cac4e8',
        'text-muted': '#a59fc8',
      },
    },
  },
})
