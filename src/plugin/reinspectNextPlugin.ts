import { fileURLToPath } from 'node:url'

export interface ReinspectNextPluginOptions {
  includeThirdParty?: boolean
  thirdPartyAllowlist?: readonly string[]
  enableInProduction?: boolean
}

interface NextWebpackOptions {
  dev: boolean
  isServer?: boolean
}

interface NextWebpackUseEntry {
  loader?: string
  options?: {
    includeThirdParty?: boolean
    thirdPartyAllowlist?: readonly string[]
  }
}

interface NextWebpackRule {
  test?: RegExp
  enforce?: 'pre' | 'post'
  exclude?: RegExp
  use?: NextWebpackUseEntry | NextWebpackUseEntry[]
}

interface NextWebpackModuleConfig {
  rules?: NextWebpackRule[]
}

interface NextWebpackConfig {
  module?: NextWebpackModuleConfig
}

type NextWebpackFunction = (
  config: NextWebpackConfig,
  options: NextWebpackOptions,
) => NextWebpackConfig

interface NextConfigLike {
  webpack?: NextWebpackFunction
}

function resolveNextLoaderPath(): string {
  const loaderUrl = new URL('./reinspectNextAutoDiscoverLoader.js', import.meta.url)

  if (loaderUrl.protocol === 'file:') {
    return fileURLToPath(loaderUrl)
  }

  return loaderUrl.pathname
}

function hasReinspectLoaderRule(rules: NextWebpackRule[]): boolean {
  for (const rule of rules) {
    const ruleUse = Array.isArray(rule.use)
      ? rule.use
      : rule.use
      ? [rule.use]
      : []

    if (ruleUse.some((entry) => entry.loader === resolveNextLoaderPath())) {
      return true
    }
  }

  return false
}

function addReinspectLoaderRule(
  config: NextWebpackConfig,
  options: ReinspectNextPluginOptions,
): NextWebpackConfig {
  const moduleConfig = config.module ?? {}
  const rules = moduleConfig.rules ?? []

  if (hasReinspectLoaderRule(rules)) {
    config.module = {
      ...moduleConfig,
      rules,
    }
    return config
  }

  const nextLoaderPath = resolveNextLoaderPath()
  const reinspectRule: NextWebpackRule = {
    test: /\.[cm]?[jt]sx?$/,
    enforce: 'pre',
    use: [
      {
        loader: nextLoaderPath,
        options: {
          includeThirdParty: options.includeThirdParty === true,
          thirdPartyAllowlist: options.thirdPartyAllowlist ?? [],
        },
      },
    ],
  }

  if (options.includeThirdParty !== true) {
    reinspectRule.exclude = /node_modules/
  }

  const nextRules: NextWebpackRule[] = [
    reinspectRule,
    ...rules,
  ]

  config.module = {
    ...moduleConfig,
    rules: nextRules,
  }

  return config
}

export function withReinspectAutoDiscover(
  nextConfig: NextConfigLike = {},
  pluginOptions: ReinspectNextPluginOptions = {},
): NextConfigLike {
  const originalWebpack = nextConfig.webpack

  return {
    ...nextConfig,
    webpack(config, options) {
      const resolvedConfig =
        typeof originalWebpack === 'function'
          ? originalWebpack(config, options) ?? config
          : config

      const shouldEnable =
        (options.dev || pluginOptions.enableInProduction === true) &&
        options.isServer !== true

      if (!shouldEnable) {
        return resolvedConfig
      }

      return addReinspectLoaderRule(resolvedConfig, pluginOptions)
    },
  }
}
