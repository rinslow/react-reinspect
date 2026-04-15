const REINSPECT_STYLE_ELEMENT_ID = 'reinspect-runtime-styles'

function getDocument(): Document | null {
  if (typeof document === 'undefined') {
    return null
  }

  return document
}

export function injectReinspectStyles(styleText: string): void {
  if (!styleText) {
    return
  }

  const doc = getDocument()
  if (!doc) {
    return
  }

  if (doc.getElementById(REINSPECT_STYLE_ELEMENT_ID)) {
    return
  }

  const styleElement = doc.createElement('style')
  styleElement.id = REINSPECT_STYLE_ELEMENT_ID
  styleElement.textContent = styleText
  const styleMountRoot = doc.head ?? doc.documentElement
  styleMountRoot.appendChild(styleElement)
}
