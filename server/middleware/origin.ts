import { recordOrigin } from '#server/utils/siteOrigin'

/**
 * Tallies each visitor's origin so background tasks can infer the site's
 * canonical public origin from real traffic. Fire-and-forget — analytics must
 * never delay or break a request, and `recordOrigin` filters out non-public
 * hosts (localhost, private IPs, …) internally.
 */
export default defineEventHandler((event) => {
  void recordOrigin(event)
})
