import type { Plugin } from 'vite'
import {
  normalizeModuleId,
  isSupportedSourceFile,
  resolveAutoDiscoverScope,
  transformModuleForAutoDiscover,
  type AutoDiscoverIncludeMode,
} from './internal/autoDiscoverTransform'

export interface ReinspectAutoDiscoverPluginOptions {
  include?: AutoDiscoverIncludeMode
  thirdPartyAllowlist?: readonly string[]
}

function resolvePluginOptions(
  options: ReinspectAutoDiscoverPluginOptions | undefined,
): Required<ReinspectAutoDiscoverPluginOptions> {
  return {
    include: options?.include ?? 'first-party',
    thirdPartyAllowlist: options?.thirdPartyAllowlist ?? [],
  }
}

export function reinspectAutoDiscoverPlugin(
  options?: ReinspectAutoDiscoverPluginOptions,
): Plugin {
  const resolvedOptions = resolvePluginOptions(options)

  return {
    name: 'reinspect-auto-discover',
    apply: 'serve',
    enforce: 'pre',
    transform(sourceCode, id) {
      const normalizedId = normalizeModuleId(id)

      if (!isSupportedSourceFile(normalizedId)) {
        return null
      }

      const scope = resolveAutoDiscoverScope(normalizedId, {
        include: resolvedOptions.include,
        thirdPartyAllowlist: resolvedOptions.thirdPartyAllowlist,
      })
      if (!scope) {
        return null
      }

      const transformedResult = transformModuleForAutoDiscover(
        sourceCode,
        normalizedId,
        scope,
      )
      if (!transformedResult.modified) {
        return null
      }

      return {
        code: transformedResult.code,
        map: null,
      }
    },
  }
}
