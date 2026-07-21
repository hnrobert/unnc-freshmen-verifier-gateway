import type { SiteConfig } from '#shared/types'
import { validateConfig } from '#shared/lib/validateConfig'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const body = await readBody<{ config?: unknown }>(event)
  let errors: string[]
  try {
    errors = validateConfig(body.config as SiteConfig)
  } catch {
    errors = ['invalid config shape']
  }
  return { errors }
})
