import { setVerificationSettings } from '#server/utils/verification'

/** Superadmin: update the site-wide verification switches. */
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const body = await readBody<{ freshmanEnabled?: unknown; emailMode?: unknown }>(event)
  await setVerificationSettings({
    freshmanEnabled: body?.freshmanEnabled !== false,
    emailMode: body?.emailMode === 'code' ? 'code' : 'welcome',
  })
  return await getVerificationSettings()
})
