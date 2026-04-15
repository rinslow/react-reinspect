/* eslint-disable react-refresh/only-export-components */

import type { ReactNode } from 'react'
import { formatRenderCountLabel, useRenderCounts } from '../core/renderCounter'
import type { InspectedValueDescriptor } from '../propsInspector'
import { highlightCode } from '../syntaxHighlight'
import type { RenderCounterMode } from '../types'

interface PropsValueTreeProps {
  value: InspectedValueDescriptor
}

export function renderPropsValueTree({ value }: PropsValueTreeProps): ReactNode {
  if (value.kind === 'function' && value.functionMeta) {
    const functionMeta = value.functionMeta
    return (
      <div className="reinspect-prop-function">
        <code>{value.summary}</code>
        <pre>
          <code
            className="language-javascript reinspect-code-block"
            dangerouslySetInnerHTML={{
              __html: highlightCode(functionMeta.preview, 'javascript'),
            }}
          />
        </pre>
      </div>
    )
  }

  return (
    <div className="reinspect-prop-scalar">
      <code>{value.summary}</code>
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
