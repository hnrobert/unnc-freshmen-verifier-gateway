import { AppDataSource } from '#server/utils/database'
import { PageShareSetting } from '#server/entities/pageShareSetting.entity'

const LIMITS = {
  fontSize: [20, 160],
  width: [240, 1920],
  height: [240, 2160],
  borderWidth: [0, 20],
  borderRadius: [0, 160],
} as const
type NumericSetting = keyof typeof LIMITS

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string
  const { page } = await requirePageRole(event, slug, RANK.editor)
  const body = await readBody<Record<string, unknown>>(event)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length > 200)
    throw createError({ statusCode: 400, statusMessage: 'Title must be 200 characters or fewer' })

  const readInt = (key: NumericSetting): number => {
    const limits = LIMITS[key]
    const value = Number(body[key])
    if (!Number.isInteger(value) || value < limits[0] || value > limits[1]) {
      throw createError({
        statusCode: 400,
        statusMessage: `${key} must be an integer from ${limits[0]} to ${limits[1]}`,
      })
    }
    return value
  }

  const values = {
    pageId: page.id,
    title,
    fontSize: readInt('fontSize'),
    width: readInt('width'),
    height: readInt('height'),
    borderWidth: readInt('borderWidth'),
    borderRadius: readInt('borderRadius'),
    updatedAt: new Date(),
  }
  await AppDataSource.getRepository(PageShareSetting).upsert(values, ['pageId'])
  return {
    title: values.title,
    fontSize: values.fontSize,
    width: values.width,
    height: values.height,
    borderWidth: values.borderWidth,
    borderRadius: values.borderRadius,
  }
})
