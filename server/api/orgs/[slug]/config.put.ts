import { eq } from 'drizzle-orm'
import { orgSettings } from '../../../db/schema'
import type { SiteConfig } from '../../../../shared/types'
import { validateConfig } from '../../../../shared/lib/validateConfig'

// Owner: validate then store the raw config (img: refs preserved).
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const org = requireOrgOwnership(event, slug)

  const body = await readBody<{ config?: unknown }>(event)
  let errors: string[]
  try {
    errors = validateConfig(body.config as SiteConfig)
  } catch {
    errors = ['invalid config shape']
  }
  if (errors.length) {
    throw createError({ statusCode: 400, statusMessage: 'Config invalid', data: { errors } })
  }

  useDB()
    .update(orgSettings)
    .set({ config: JSON.stringify(body.config), updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(orgSettings.orgId, org.id))
    .run()

  invalidateOrgConfig(slug)
  return { ok: true }
})
