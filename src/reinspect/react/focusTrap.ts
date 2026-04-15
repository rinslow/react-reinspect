const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => isElementVisible(element))
}

export function focusFirstFocusableElement(container: HTMLElement): void {
  const focusableElements = getFocusableElements(container)
  const firstElement = focusableElements[0]
  if (firstElement) {
    firstElement.focus()
    return
  }

  container.focus()
}

export function trapFocusWithinContainer(
  event: KeyboardEvent,
  container: HTMLElement,
): void {
  if (event.key !== 'Tab') {
    return
  }

  const focusableElements = getFocusableElements(container)
  if (focusableElements.length === 0) {
    event.preventDefault()
    container.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  if (!firstElement || !lastElement) {
    event.preventDefault()
    container.focus()
    return
  }

  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  const activeElementInsideContainer =
    activeElement && container.contains(activeElement)

  if (event.shiftKey) {
    if (!activeElementInsideContainer || activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    }
    return
  }

  if (!activeElementInsideContainer || activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}
