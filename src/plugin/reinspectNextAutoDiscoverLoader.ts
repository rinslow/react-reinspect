import path from 'node:path'
import {
  shouldSkipThirdPartyModule,
  transformModuleForAutoDiscover,
} from './reinspectAutoDiscoverPlugin'

type AutoDiscoverScope = 'first-party' | 'third-party'

interface ReinspectNextLoaderOptions {
  includeThirdParty?: boolean
}

interface LoaderContextLike {
  resourcePath: string
  getOptions?: () => ReinspectNextLoaderOptions
  async?: () => ((error: Error | null, code?: string) => void) | undefined
}

const SUPPORTED_FILE_PATTERN = /\.[cm]?[jt]sx?$/

function normalizeModuleId(id: string): string {
  return id.split(path.sep).join('/')
}

function isSupportedSourceFile(id: string): boolean {
  if (!SUPPORTED_FILE_PATTERN.test(id)) {
    return false
  }

  if (id.includes('/node_modules/react-reinspect/')) {
    return false
  }

  return true
}

function resolveAutoDiscoverScope(
  normalizedId: string,
  includeThirdParty: boolean,
): AutoDiscoverScope | null {
  const isThirdParty = normalizedId.includes('/node_modules/')
  if (!isThirdParty) {
    return 'first-party'
  }

  if (!includeThirdParty || shouldSkipThirdPartyModule(normalizedId)) {
    return null
  }

  return 'third-party'
}

function runTransform(
  sourceCode: string,
  normalizedId: string,
  options: ReinspectNextLoaderOptions,
): string {
  if (!isSupportedSourceFile(normalizedId)) {
    return sourceCode
  }

  const includeThirdParty = Boolean(options.includeThirdParty)
  const scope = resolveAutoDiscoverScope(normalizedId, includeThirdParty)
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
