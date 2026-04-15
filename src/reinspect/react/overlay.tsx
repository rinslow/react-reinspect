/* eslint-disable react-refresh/only-export-components */

import type { ReactNode } from 'react'
import { formatRenderCountLabel, useRenderCounts } from '../core/renderCounter'
import type { InspectedValueDescriptor } from '../propsInspector'
import type { RenderCounterMode } from '../types'

interface PropsValueTreeProps {
  value: InspectedValueDescriptor
  onCopy: (text: string, label: string) => void
}

export function renderPropsValueTree({
  value,
  onCopy,
}: PropsValueTreeProps): ReactNode {
  if (value.kind === 'function' && value.functionMeta) {
    const functionMeta = value.functionMeta
    return (
      <div className="reinspect-prop-function">
        <code>{value.summary}</code>
        <pre>{functionMeta.preview}</pre>
        <button
          type="button"
          onClick={() => onCopy(functionMeta.source, 'Function source')}
          disabled={!functionMeta.source}
        >
          Copy function source
        </button>
      </div>
    )
  }

  return (
    <div className="reinspect-prop-scalar">
      <code>{value.summary}</code>
      {value.copyText ? (
        <button type="button" onClick={() => onCopy(value.copyText ?? '', 'Value')}>
          Copy
        </button>
      ) : null}
    </div>
  )
}

interface RenderCountBadgeProps {
  instanceId: string
  counterMode: Exclude<RenderCounterMode, 'off'>
}

export function RenderCountBadge({
  instanceId,
  counterMode,
}: RenderCountBadgeProps) {
  const counts = useRenderCounts(instanceId)
  return <>{formatRenderCountLabel(counts, counterMode)}</>
}
