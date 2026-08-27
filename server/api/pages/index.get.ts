import { listAccessiblePages } from '#server/utils/members'

/** List every page the caller can access (owned ∪ actively shared), each tagged with role. */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const accessible = await listAccessiblePages(user.id)
  return {
    pages: accessible.map(({ page, role }) => ({
      id: page.id,
      slug: page.slug,
      name: page.name,
      createdAt: page.createdAt,
      role,
    })),
  }
})
