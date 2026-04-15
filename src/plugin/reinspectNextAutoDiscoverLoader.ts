import {
  normalizeModuleId,
  isSupportedSourceFile,
  resolveAutoDiscoverScope,
  transformModuleForAutoDiscover,
} from './internal/autoDiscoverTransform.js'

interface ReinspectNextLoaderOptions {
  includeThirdParty?: boolean
  thirdPartyAllowlist?: string[]
}

interface LoaderContextLike {
  resourcePath: string
  getOptions?: () => ReinspectNextLoaderOptions
  async?: () => ((error: Error | null, code?: string) => void) | undefined
}

function runTransform(
  sourceCode: string,
  normalizedId: string,
  options: ReinspectNextLoaderOptions,
): string {
  if (!isSupportedSourceFile(normalizedId)) {
    return sourceCode
  }

  const scope = resolveAutoDiscoverScope(normalizedId, {
    include: options.includeThirdParty ? 'all' : 'first-party',
    thirdPartyAllowlist: options.thirdPartyAllowlist ?? [],
  })
  if (!scope) {
    return sourceCode
  }

  const transformedResult = transformModuleForAutoDiscover(
    sourceCode,
    normalizedId,
    scope,
  )

  return transformedResult.modified ? transformedResult.code : sourceCode
}

export default function reinspectNextAutoDiscoverLoader(
  this: LoaderContextLike,
  sourceCode: string,
): string | void {
  const options = this.getOptions?.() ?? {}
  const normalizedId = normalizeModuleId(this.resourcePath ?? '')
  const callback = this.async?.()

  try {
    const transformedCode = runTransform(sourceCode, normalizedId, options)

    if (callback) {
      callback(null, transformedCode)
      return
    }

    return transformedCode
  } catch (error) {
    const nextError =
      error instanceof Error ? error : new Error('Failed to transform module')

    if (callback) {
      callback(nextError)
      return
    }

    throw nextError
  }
}
