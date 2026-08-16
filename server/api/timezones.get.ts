/** All IANA timezones this server's runtime supports (`Intl.supportedValuesOf`),
 * sorted. The page editor fetches this to populate its reminder-timezone picker,
 * so the available zones are decided server-side — the server is what runs the
 * scheduler — rather than hardcoded on the client. Public: zone names only. */
export default defineEventHandler(() => {
  const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
  const zones = fn ? fn('timeZone') : []
  return zones.slice().sort((a, b) => a.localeCompare(b))
})
