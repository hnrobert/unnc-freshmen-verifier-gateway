export default defineEventHandler((event) => {
  clearAuthSession(event)
  return { ok: true }
})
