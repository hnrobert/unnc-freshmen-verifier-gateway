export default defineEventHandler((event) => {
  const user = requireAuth(event)
  return { user }
})
