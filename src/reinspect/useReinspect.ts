import { useContext } from 'react'
import { ReinspectContext } from './store'
import type { ReinspectContextValue } from './types'

export function useReinspect(): ReinspectContextValue {
  const contextValue = useContext(ReinspectContext)
  if (!contextValue) {
    throw new Error('useReinspect must be used within ReinspectProvider')
  }

  return contextValue
}
