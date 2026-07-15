import { AppDataSource } from '../../../../utils/database'
import { Organization } from '../../../../entities/organization.entity'
import { OrgImage } from '../../../../entities/orgImage.entity'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const key = getRouterParam(event, 'key') as string

  const org = await AppDataSource.getRepository(Organization).findOne({ where: { slug } })
  if (!org) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const img = await AppDataSource.getRepository(OrgImage).findOne({ where: { orgId: org.id, key } })
  if (!img) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setHeader(event, 'Content-Type', img.mime)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'ETag', `"${img.id}"`)
  return Buffer.from(img.base64, 'base64')
})
