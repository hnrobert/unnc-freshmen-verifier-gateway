/** Claim an invite. Requires a logged-in user whose email matches the invited email. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const token = getRouterParam(event, 'token') as string
  const member = await claimInvite(token, user)
  return { ok: true, orgId: member.orgId }
})
