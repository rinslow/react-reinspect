import { ReinspectProvider, type ReinspectConfig } from 'react-reinspect'
import 'react-reinspect/style.css'

const reinspectConfig: ReinspectConfig = {
  enabled: import.meta.env.DEV,
  startActive: true,
  showFloatingToggle: true,
  inspectMode: 'first-party',
  zIndexBase: 2147483000,
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ReinspectProvider config={reinspectConfig}>{children}</ReinspectProvider>
}
