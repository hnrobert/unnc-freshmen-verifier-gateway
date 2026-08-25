import { getVerificationSettings } from '#server/utils/verification'

/**
 * Public: which verification gateways are currently open on this site — drives
 * the public page's tab rendering (freshman tab hidden when disabled; email tab
 * switches between "mail me the welcome" and "verify by code" flows).
 */
export default defineEventHandler(async () => {
  const s = await getVerificationSettings()
  return { freshmanEnabled: s.freshmanEnabled, emailMode: s.emailMode }
})
