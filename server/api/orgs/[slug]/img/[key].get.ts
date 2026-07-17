import { AppDataSource } from '../../../../utils/database'
import { Organization } from '../../../../entities/organization.entity'
import { OrgImage } from '../../../../entities/orgImage.entity'

// Returns raw base64 + mime as JSON. The frontend constructs the data URL.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const key = getRouterParam(event, 'key') as string

  const org = await AppDataSource.getRepository(Organization).findOne({ where: { slug } })
  if (!org) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const img = await AppDataSource.getRepository(OrgImage).findOne({ where: { orgId: org.id, key } })
  if (!img) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return { mime: img.mime, base64: img.base64 }
})
