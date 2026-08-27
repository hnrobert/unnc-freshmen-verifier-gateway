import { getVerificationSettings } from '#server/utils/verification'

/**
 * Public: which verification gateways are currently open on this site — drives
 * the public page's tab rendering (freshman tab hidden when disabled; email
 * tab hidden when no email mode is on; with both modes on, the tab shows a
 * flow selector — otherwise it goes straight to the single enabled flow).
 */
export default defineEventHandler(async () => {
  const s = await getVerificationSettings()
  return { freshmanEnabled: s.freshmanEnabled, emailModes: s.emailModes }
})
