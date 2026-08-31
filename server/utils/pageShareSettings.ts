import type { ShareSettings } from '#shared/types'
import { DEFAULT_SHARE_SETTINGS } from '#shared/lib/poster'
import { AppDataSource } from './database'
import { PageShareSetting } from '#server/entities/pageShareSetting.entity'

/** Load a page's saved Share-tab defaults (defaults when no row exists). */
export async function loadPageShareSettings(pageId: number): Promise<ShareSettings> {
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
    : { ...DEFAULT_SHARE_SETTINGS }
}
