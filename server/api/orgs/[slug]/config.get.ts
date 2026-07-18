import { AppDataSource } from '../../../utils/database'
import { OrgSetting } from '../../../entities/orgSetting.entity'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  if (getQuery(event).edit !== undefined) {
    const { org } = await requireOrgRole(event, slug, RANK.viewer)
    const settings = await AppDataSource.getRepository(OrgSetting).findOne({
      where: { orgId: org.id },
    })
    if (!settings) throw createError({ statusCode: 404, statusMessage: 'Config not found' })
    return JSON.parse(settings.config)
  }
  return await loadOrgConfig(slug)
})
