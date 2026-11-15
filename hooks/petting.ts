import type { ClientModule } from 'claude-code'

/**
 * Une zone transparente posée sur le bandeau : un clic y envoie au mod la colonne où il est tombé,
 * et le mod regarde si le teckel s'y trouve (le dessin du bandeau est une image, qui ne reçoit pas les clics).
 */
const Petting: ClientModule<null, true> = (_props, surface) => {
  if (surface.state === undefined) {
    surface.onPointer(event => {
      if (event.type === 'down' && (event.button ?? 'left') === 'left') {
        surface.post({ x: event.fine?.x ?? event.x + 0.5 })
      }
    })
    surface.setState(true)
  }

  return surface.elements.Box({ width: '100%', height: '100%' })
}

export default Petting
