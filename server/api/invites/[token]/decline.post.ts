/** Decline (delete) a pending invite. Requires a logged-in user whose email matches. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const token = getRouterParam(event, 'token') as string
  await declineInvite(token, user)
  return { ok: true }
})
