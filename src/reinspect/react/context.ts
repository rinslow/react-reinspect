import { createContext } from 'react'
import type { ReinspectContextValue } from '../types'

export const ReinspectContext = createContext<ReinspectContextValue | null>(null)
