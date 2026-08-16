import { readFile } from 'node:fs/promises'
import { transformSync } from 'esbuild'

/** Mirrors the root tsconfig's decorator flags (required by TypeORM entities). */
const tsconfigRaw = {
  compilerOptions: {
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    target: 'esnext',
  },
}

/** Resolve extensionless relative TS imports (`./user.entity` → `.ts`). */
export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !specifier.endsWith('.ts') &&
    !specifier.endsWith('.js') &&
    !specifier.endsWith('.mjs') &&
    !specifier.endsWith('.json')
  ) {
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return await nextResolve(candidate, context)
      } catch {
        // try the next candidate
      }
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.ts')) {
    const source = await readFile(new URL(url), 'utf8')
    const { code } = transformSync(source, {
      loader: 'ts',
      format: 'esm',
      target: 'node24',
      tsconfigRaw,
    })
    return { format: 'module', shortCircuit: true, source: code }
  }
  return nextLoad(url, context)
}
