import { AppDataSource } from '#server/utils/database'
import { PageMember } from '#server/entities/pageMember.entity'
import { renderEmail } from '#server/mail/render'
import { isSecureRequest } from '#server/utils/request'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const ROLES = ['viewer', 'editor', 'manager'] as const

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Invite a user by email (creates a pending member + one-time token) and sends
 * an invitation email via the site mail config. Manager+. */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const slug = getRouterParam(event, 'slug') as string
  const { page, rank } = await requirePageRole(event, slug, RANK.manager)

  // Per-account sending throttle (aggregated across all email flows): 6/min, 24/day.
  const accountLimit = checkAccountSend(me.id)
  if (!accountLimit.allowed) throw createError(emailLimitError(accountLimit))

  const body = await readBody<{ email?: unknown; role?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  const role = String(body?.role ?? 'viewer')
  if (!EMAIL_RE.test(email)) throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  if (!(ROLES as readonly string[]).includes(role))
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  // Only the owner may grant the manager role (prevent privilege escalation).
  if (role === 'manager' && rank < RANK.owner)
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can invite a manager' })

  const repo = AppDataSource.getRepository(PageMember)
  const existing = await repo.findOne({ where: { pageId: page.id, invitedEmail: email } })
  if (existing)
    throw createError({ statusCode: 409, statusMessage: 'That email has already been invited' })

  // Per-target invite throttle: at most 1/min and 10/day to one address.
  const inviteLimit = checkEmailSend('invite', email)
  if (!inviteLimit.allowed) throw createError(emailLimitError(inviteLimit))

  const token = generateInviteToken()
  const member = await repo.save({
    pageId: page.id,
    userId: null,
    invitedEmail: email,
    inviteToken: token,
    role,
    status: 'pending',
    invitedBy: me.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  })
  const inviteUrl = buildInviteUrl(event, slug)

  // Send invitation email (best-effort — invite succeeds even if mail fails)
  void (async () => {
    try {
      const cfg = await getMailConfig()
      if (!cfg) return
      const pageConfig = await loadPageConfig(slug)
      const locale = pageConfig.defaultLocale
      const xfh2 = getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim()
      const host2 = xfh2 || getRequestHeader(event, 'host') || 'localhost'
      const proto2 = isSecureRequest(event) ? 'https' : 'http'
      const pageLink = `${proto2}://${host2}/${slug}`
      const pageNameHtml = `<a href="${pageLink}" style="color: inherit; font-weight: 700;">${escapeHtml(page.name)}</a>`
      const subject = tpl(emailMsg(pageConfig, locale, 'inviteSubject'), { org: page.name })
      const html = renderEmail({
        title: subject,
        bodyHtml: `<p>${tpl(emailMsg(pageConfig, locale, 'inviteBody'), { org: pageNameHtml, role: escapeHtml(role) })}</p><p>${emailMsg(pageConfig, locale, 'inviteAction')}</p>`,
        actionLabel: emailMsg(pageConfig, locale, 'inviteButton'),
        actionUrl: inviteUrl,
        preheader: tpl(emailMsg(pageConfig, locale, 'invitePreheader'), { org: page.name, role }),
      })
      await sendMailWithConfig(cfg, {
        to: email,
        subject,
        body: html,
        html: true,
      })
    } catch {
      // best-effort — invitation email is not critical
    }
  })()

  void recordAudit(event, {
    action: 'collaborator.add',
    outcome: 'success',
    actorType: 'user',
    userId: me.id,
    email: me.email,
    pageId: page.id,
    detail: {
      collaboratorId: member.id,
      invitedEmail: member.invitedEmail,
      role: member.role,
      status: member.status,
    },
  })

  const warning = [accountLimit.warning, inviteLimit.warning].filter(Boolean).join(' ') || undefined
  return { id: member.id, inviteUrl, warning }
})
