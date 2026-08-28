import { AppDataSource } from './database'
import { PageShareSetting } from '#server/entities/pageShareSetting.entity'

export interface PageShareSettingsValue {
  title: string
  fontSize: number
  width: number
  height: number
  borderWidth: number
  borderRadius: number
}

export const DEFAULT_PAGE_SHARE_SETTINGS: PageShareSettingsValue = {
  title: '',
  fontSize: 60,
  width: 480,
  height: 680,
  borderWidth: 0,
  borderRadius: 12,
}

export async function loadPageShareSettings(pageId: number): Promise<PageShareSettingsValue> {
  const row = await AppDataSource.getRepository(PageShareSetting).findOne({ where: { pageId } })
  return row
    ? {
        title: row.title,
        fontSize: row.fontSize,
        width: row.width,
        height: row.height,
        borderWidth: row.borderWidth,
        borderRadius: row.borderRadius,
      }
    : { ...DEFAULT_PAGE_SHARE_SETTINGS }
}
