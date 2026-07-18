import { listAccessibleOrgs } from '../../utils/members'

/** List every org the caller can access (owned ∪ actively shared), each tagged with role. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const accessible = await listAccessibleOrgs(user.id)
  return {
    orgs: accessible.map(({ org, role }) => ({
      id: org.id,
      slug: org.slug,
      name: org.name,
      createdAt: org.createdAt,
      role,
    })),
  }
})
