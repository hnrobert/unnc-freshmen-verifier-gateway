import { setVerificationSettings, EMAIL_MODES } from '#server/utils/verification'

/** Superadmin: update the site-wide verification switches. `emailModes` is a
 * multi-select — any subset (including none, which disables the email tab) of
 * ['welcome', 'code']. */
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)
  const body = await readBody<{ freshmanEnabled?: unknown; emailModes?: unknown }>(event)
  const modes = Array.isArray(body?.emailModes)
    ? body.emailModes.filter((m): m is string => EMAIL_MODES.includes(m as never))
    : []
  // De-dup, keeping the canonical order.
  const emailModes = EMAIL_MODES.filter((m) => modes.includes(m))
  await setVerificationSettings({
    freshmanEnabled: body?.freshmanEnabled !== false,
    emailModes,
  })
  return await getVerificationSettings()
})
