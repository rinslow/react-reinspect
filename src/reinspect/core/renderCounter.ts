import { useCallback, useSyncExternalStore } from 'react'
import type { RenderCounterMode } from '../types'

export interface RenderCounts {
  attempts: number
  commits: number
}

type Listener = () => void

const EMPTY_COUNTS: RenderCounts = {
  attempts: 0,
  commits: 0,
}

const renderCountByInstance = new Map<string, RenderCounts>()
const listenersByInstance = new Map<string, Set<Listener>>()

function getOrCreateRenderCount(instanceId: string): RenderCounts {
  const existing = renderCountByInstance.get(instanceId)
  if (existing) {
    return existing
  }

  const next: RenderCounts = {
    attempts: 0,
    commits: 0,
  }

  renderCountByInstance.set(instanceId, next)
  return next
}

function notify(instanceId: string): void {
  const listeners = listenersByInstance.get(instanceId)
  if (!listeners) {
    return
  }

  for (const listener of listeners) {
    listener()
  }
}

export function incrementRenderCounts(instanceId: string): void {
  const counts = getOrCreateRenderCount(instanceId)
  renderCountByInstance.set(instanceId, {
    attempts: counts.attempts + 1,
    commits: counts.commits + 1,
  })
  notify(instanceId)
}

export function readRenderCounts(instanceId: string): RenderCounts {
  const counts = renderCountByInstance.get(instanceId)
  if (!counts) {
    return EMPTY_COUNTS
  }

  return counts
}

export function resetRenderCounts(instanceId: string): void {
  renderCountByInstance.delete(instanceId)
  notify(instanceId)
}

function subscribeToRenderCounts(
  instanceId: string,
  listener: Listener,
): () => void {
  const listeners = listenersByInstance.get(instanceId)
  if (listeners) {
    listeners.add(listener)
  } else {
    listenersByInstance.set(instanceId, new Set<Listener>([listener]))
  }

  return () => {
    const currentListeners = listenersByInstance.get(instanceId)
    if (!currentListeners) {
      return
    }

    currentListeners.delete(listener)
    if (currentListeners.size === 0) {
      listenersByInstance.delete(instanceId)
    }
  }
}

export function useRenderCounts(instanceId: string): RenderCounts {
  const subscribe = useCallback(
    (listener: Listener) => subscribeToRenderCounts(instanceId, listener),
    [instanceId],
  )
  const getSnapshot = useCallback(
    () => readRenderCounts(instanceId),
    [instanceId],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_COUNTS)
}

export function formatRenderCountLabel(
  counts: RenderCounts,
  counterMode: RenderCounterMode,
): string {
  if (counterMode === 'commits') {
    return `${counts.commits} commits`
  }

  if (counterMode === 'both') {
    return `${counts.attempts} attempts | ${counts.commits} commits`
  }

  return `${counts.attempts} attempts`
}
