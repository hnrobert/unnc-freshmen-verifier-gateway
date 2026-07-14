// Runs on every request: resolve the session cookie into event.context.user.
export default defineEventHandler((event) => {
  event.context.user = getSessionUser(event)
})
