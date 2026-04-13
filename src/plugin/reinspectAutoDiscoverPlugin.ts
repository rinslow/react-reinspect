import path from 'node:path'
import { parse } from '@babel/parser'
import { generate } from '@babel/generator'
import * as t from '@babel/types'
import type { Plugin } from 'vite'

type AutoDiscoverScope = 'first-party' | 'third-party'

const AUTO_WRAP_IMPORT_SOURCE = 'react-reinspect'
const AUTO_WRAP_IMPORT_NAME = 'autoWrapInspectable'
const DEFAULT_EXPORT_LOCAL_IDENTIFIER = '__reinspect_default_component'
const SUPPORTED_FILE_PATTERN = /\.[cm]?[jt]sx?$/

const THIRD_PARTY_SKIP_PATTERNS = [
  '/node_modules/react/',
  '/node_modules/react-dom/',
  '/node_modules/scheduler/',
  '/node_modules/@vite/',
  '/node_modules/vite/',
  '/node_modules/@react-refresh/',
]

export interface AutoDiscoverTransformResult {
  code: string
  modified: boolean
}

function normalizeModuleId(id: string): string {
  const withoutQuery = id.split('?')[0]
  return withoutQuery.split(path.sep).join('/')
}

function isPascalCaseIdentifier(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name)
}

function inferFallbackName(filePath: string): string {
  const baseName = path.basename(filePath).replace(/\.[^.]+$/, '')
  const tokens = baseName
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) {
    return 'Component'
  }

  return tokens
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join('')
}

function unwrapExpression(node: t.Expression): t.Expression {
  let currentNode = node

  while (
    t.isParenthesizedExpression(currentNode) ||
    t.isTSAsExpression(currentNode) ||
    t.isTSTypeAssertion(currentNode) ||
    t.isTSNonNullExpression(currentNode) ||
    t.isTSInstantiationExpression(currentNode) ||
    t.isTypeCastExpression(currentNode)
  ) {
    currentNode = currentNode.expression
  }

  return currentNode
}

function isReactCreateElementCall(node: t.CallExpression): boolean {
  const callee = unwrapExpression(node.callee as t.Expression)

  if (t.isIdentifier(callee)) {
    return callee.name === 'createElement'
  }

  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object) &&
    callee.object.name === 'React' &&
    t.isIdentifier(callee.property)
  ) {
    return callee.property.name === 'createElement'
  }

  return false
}

function isAstNode(value: unknown): value is t.Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}

function containsRenderableReactNode(node: t.Node | null | undefined): boolean {
  if (!node) {
    return false
  }

  if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    return true
  }

  if (t.isCallExpression(node) && isReactCreateElementCall(node)) {
    return true
  }

  for (const fieldValue of Object.values(node)) {
    if (Array.isArray(fieldValue)) {
      for (const value of fieldValue) {
        if (isAstNode(value) && containsRenderableReactNode(value)) {
          return true
        }
      }
      continue
    }

    if (isAstNode(fieldValue) && containsRenderableReactNode(fieldValue)) {
      return true
    }
  }

  return false
}

function isComponentFunction(
  node: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression,
): boolean {
  if (t.isBlockStatement(node.body)) {
    return containsRenderableReactNode(node.body)
  }

  return containsRenderableReactNode(node.body)
}

function isMemoForwardRefCallee(callee: t.Expression): boolean {
  const expression = unwrapExpression(callee)

  if (t.isIdentifier(expression)) {
    return expression.name === 'memo' || expression.name === 'forwardRef'
  }

  if (
    t.isMemberExpression(expression) &&
    t.isIdentifier(expression.object) &&
    expression.object.name === 'React' &&
    t.isIdentifier(expression.property)
  ) {
    return (
      expression.property.name === 'memo' ||
      expression.property.name === 'forwardRef'
    )
  }

  return false
}

function isMemoForwardRefCall(node: t.CallExpression): boolean {
  const callee = unwrapExpression(node.callee as t.Expression)

  if (!isMemoForwardRefCallee(callee)) {
    return false
  }

  if (node.arguments.length === 0) {
    return false
  }

  const firstArgument = node.arguments[0]
  if (!t.isExpression(firstArgument)) {
    return false
  }

  const componentCandidate = unwrapExpression(firstArgument)
  if (
    t.isArrowFunctionExpression(componentCandidate) ||
    t.isFunctionExpression(componentCandidate)
  ) {
    return isComponentFunction(componentCandidate)
  }

  if (t.isIdentifier(componentCandidate)) {
    return isPascalCaseIdentifier(componentCandidate.name)
  }

  return true
}

function isWrappedInitializer(node: t.Expression): boolean {
  const expression = unwrapExpression(node)
  if (!t.isCallExpression(expression)) {
    return false
  }

  const callee = unwrapExpression(expression.callee as t.Expression)
  return (
    t.isIdentifier(callee) &&
    (callee.name === AUTO_WRAP_IMPORT_NAME || callee.name === 'withReinspect')
  )
}

function isComponentInitializer(node: t.Expression): boolean {
  const expression = unwrapExpression(node)

  if (t.isArrowFunctionExpression(expression) || t.isFunctionExpression(expression)) {
    return isComponentFunction(expression)
  }

  if (t.isCallExpression(expression)) {
    return isMemoForwardRefCall(expression)
  }

  return false
}

function createAutoWrapCall(
  expression: t.Expression,
  componentName: string | undefined,
  scope: AutoDiscoverScope,
  fallbackName: string,
): t.CallExpression {
  const metadataProperties: t.ObjectProperty[] = [
    t.objectProperty(t.identifier('scope'), t.stringLiteral(scope)),
    t.objectProperty(t.identifier('fallbackName'), t.stringLiteral(fallbackName)),
  ]

  if (componentName) {
    metadataProperties.unshift(
      t.objectProperty(t.identifier('componentName'), t.stringLiteral(componentName)),
    )
  }

  return t.callExpression(t.identifier(AUTO_WRAP_IMPORT_NAME), [
    expression,
    t.objectExpression(metadataProperties),
  ])
}

function createFunctionWrapAssignment(
  name: string,
  scope: AutoDiscoverScope,
  fallbackName: string,
): t.Statement {
  return t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.identifier(name),
      createAutoWrapCall(t.identifier(name), name, scope, fallbackName),
    ),
  )
}

function functionDeclarationToExpression(
  node: t.FunctionDeclaration,
): t.FunctionExpression {
  const expression = t.functionExpression(
    node.id,
    node.params,
    node.body,
    node.generator,
    node.async,
  )

  expression.typeParameters = node.typeParameters
  expression.returnType = node.returnType
  return expression
}

function isSupportedSourceFile(id: string): boolean {
  if (id.startsWith('\0') || id.startsWith('/@')) {
    return false
  }

  return SUPPORTED_FILE_PATTERN.test(id)
}

function isFirstPartyModule(id: string): boolean {
  return id.includes('/src/') && !id.includes('/node_modules/')
}

export function shouldSkipThirdPartyModule(id: string): boolean {
  return THIRD_PARTY_SKIP_PATTERNS.some((pattern) => id.includes(pattern))
}

export function transformModuleForAutoDiscover(
  code: string,
  fileId: string,
  scope: AutoDiscoverScope,
): AutoDiscoverTransformResult {
  let ast
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    })
  } catch {
    return { code, modified: false }
  }

  const program = ast.program
  const fallbackName = inferFallbackName(fileId)
  let modified = false

  let autoWrapImportDeclaration: t.ImportDeclaration | undefined
  let hasAutoWrapImport = false

  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement)) {
      continue
    }

    if (statement.source.value !== AUTO_WRAP_IMPORT_SOURCE) {
      continue
    }

    autoWrapImportDeclaration = statement
    hasAutoWrapImport = statement.specifiers.some(
      (specifier) =>
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported) &&
        specifier.imported.name === AUTO_WRAP_IMPORT_NAME,
    )
  }

  for (let index = 0; index < program.body.length; index += 1) {
    const statement = program.body[index]

    if (t.isFunctionDeclaration(statement) && statement.id) {
      if (
        isPascalCaseIdentifier(statement.id.name) &&
        isComponentFunction(statement)
      ) {
        program.body.splice(
          index + 1,
          0,
          createFunctionWrapAssignment(statement.id.name, scope, fallbackName),
        )
        index += 1
        modified = true
      }
      continue
    }

    if (
      t.isExportNamedDeclaration(statement) &&
      statement.declaration &&
      t.isFunctionDeclaration(statement.declaration) &&
      statement.declaration.id &&
      isPascalCaseIdentifier(statement.declaration.id.name) &&
      isComponentFunction(statement.declaration)
    ) {
      program.body.splice(
        index + 1,
        0,
        createFunctionWrapAssignment(
          statement.declaration.id.name,
          scope,
          fallbackName,
        ),
      )
      index += 1
      modified = true
      continue
    }

    const processVariableDeclaration = (
      declaration: t.VariableDeclaration,
    ): boolean => {
      let declarationChanged = false

      for (const declarator of declaration.declarations) {
        if (!t.isIdentifier(declarator.id) || !declarator.init) {
          continue
        }

        if (!isPascalCaseIdentifier(declarator.id.name)) {
          continue
        }

        if (!isComponentInitializer(declarator.init)) {
          continue
        }

        if (isWrappedInitializer(declarator.init)) {
          continue
        }

        declarator.init = createAutoWrapCall(
          declarator.init,
          declarator.id.name,
          scope,
          fallbackName,
        )
        declarationChanged = true
      }

      return declarationChanged
    }

    if (t.isVariableDeclaration(statement)) {
      if (processVariableDeclaration(statement)) {
        modified = true
      }
      continue
    }

    if (
      t.isExportNamedDeclaration(statement) &&
      statement.declaration &&
      t.isVariableDeclaration(statement.declaration)
    ) {
      if (processVariableDeclaration(statement.declaration)) {
        modified = true
      }
      continue
    }

    if (!t.isExportDefaultDeclaration(statement)) {
      continue
    }

    const declaration = statement.declaration

    if (t.isFunctionDeclaration(declaration)) {
      if (
        declaration.id &&
        isPascalCaseIdentifier(declaration.id.name) &&
        isComponentFunction(declaration)
      ) {
        const localName = declaration.id.name
        const replacementStatements: Array<t.Statement | t.ModuleDeclaration> = [
          declaration,
          createFunctionWrapAssignment(localName, scope, fallbackName),
          t.exportDefaultDeclaration(t.identifier(localName)),
        ]

        program.body.splice(index, 1, ...replacementStatements)
        index += replacementStatements.length - 1
        modified = true
        continue
      }

      if (!declaration.id && isComponentFunction(declaration)) {
        const localIdentifier = t.identifier(DEFAULT_EXPORT_LOCAL_IDENTIFIER)
        const wrappedValue = createAutoWrapCall(
          functionDeclarationToExpression(declaration),
          undefined,
          scope,
          fallbackName,
        )
        const replacementStatements: Array<t.Statement | t.ModuleDeclaration> = [
          t.variableDeclaration('const', [
            t.variableDeclarator(localIdentifier, wrappedValue),
          ]),
          t.exportDefaultDeclaration(localIdentifier),
        ]

        program.body.splice(index, 1, ...replacementStatements)
        index += replacementStatements.length - 1
        modified = true
      }
      continue
    }

    if (!t.isExpression(declaration)) {
      continue
    }

    if (!isComponentInitializer(declaration) || isWrappedInitializer(declaration)) {
      continue
    }

    const localIdentifier = t.identifier(DEFAULT_EXPORT_LOCAL_IDENTIFIER)
    const wrappedValue = createAutoWrapCall(
      declaration,
      undefined,
      scope,
      fallbackName,
    )
    const replacementStatements: Array<t.Statement | t.ModuleDeclaration> = [
      t.variableDeclaration('const', [
        t.variableDeclarator(localIdentifier, wrappedValue),
      ]),
      t.exportDefaultDeclaration(localIdentifier),
    ]

    program.body.splice(index, 1, ...replacementStatements)
    index += replacementStatements.length - 1
    modified = true
  }

  if (!modified) {
    return { code, modified: false }
  }

  if (autoWrapImportDeclaration) {
    if (!hasAutoWrapImport) {
      autoWrapImportDeclaration.specifiers.push(
        t.importSpecifier(
          t.identifier(AUTO_WRAP_IMPORT_NAME),
          t.identifier(AUTO_WRAP_IMPORT_NAME),
        ),
      )
    }
  } else {
    let insertIndex = 0
    while (
      insertIndex < program.body.length &&
      t.isImportDeclaration(program.body[insertIndex])
    ) {
      insertIndex += 1
    }

    program.body.splice(
      insertIndex,
      0,
      t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier(AUTO_WRAP_IMPORT_NAME),
            t.identifier(AUTO_WRAP_IMPORT_NAME),
          ),
        ],
        t.stringLiteral(AUTO_WRAP_IMPORT_SOURCE),
      ),
    )
  }

  const output = generate(ast, {
    jsescOption: { minimal: true },
  })

  return {
    code: output.code,
    modified: true,
  }
}

export function reinspectAutoDiscoverPlugin(): Plugin {
  return {
    name: 'reinspect-auto-discover',
    apply: 'serve',
    enforce: 'pre',
    transform(sourceCode, id) {
      const normalizedId = normalizeModuleId(id)

      if (!isSupportedSourceFile(normalizedId)) {
        return null
      }

      if (normalizedId.includes('/node_modules/react-reinspect/')) {
        return null
      }

      if (normalizedId.includes('/src/reinspect/')) {
        return null
      }

      const scope: AutoDiscoverScope = isFirstPartyModule(normalizedId)
        ? 'first-party'
        : 'third-party'

      if (scope === 'third-party' && shouldSkipThirdPartyModule(normalizedId)) {
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
