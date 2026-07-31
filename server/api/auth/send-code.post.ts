import { randomInt } from 'node:crypto'
import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { renderEmail } from '#server/mail/render'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Send a 6-digit verification code to `email`, scoped to a client-chosen
 * `session` (so concurrent flows don't collide). Used by the registration flow:
 * the code is later verified by `POST /api/auth/register`.
 *
 * - Per-email rate limit: 1 / minute (429 otherwise).
 * - Email whitelist applies once the first user exists (bootstrap exempt).
 * - Already-registered emails return OK silently (no enumeration, no spam).
 * - Requires mail to be configured (400 otherwise).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; session?: unknown }>(event)
  const email = String(body?.email ?? '')
    .trim()
    .toLowerCase()
  const session = String(body?.session ?? '').trim()
  if (!EMAIL_RE.test(email)) throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  if (!session) throw createError({ statusCode: 400, statusMessage: 'Missing session' })

  const repo = AppDataSource.getRepository(User)
  const userCount = await repo.count()

  // Whitelist (same rule as register) — bootstrap (userCount === 0) is exempt.
  if (userCount > 0) {
    const wl = await getEmailWhitelist()
    if (wl.enabled && !emailMatchesWhitelist(email, wl.patterns)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'This email domain is not allowed to register',
      })
    }
  }

  // Don't reveal whether an account exists, and don't spam existing users.
  if (await repo.findOne({ where: { email } })) return { ok: true }

  const cfg = await getMailConfig()
  if (!cfg) throw createError({ statusCode: 400, statusMessage: 'Mail is not configured' })

  if (!rateLimit(`code:${email}`, 1, 60_000))
    throw createError({
      statusCode: 429,
      statusMessage: 'Please wait a minute before requesting another code',
    })

  const code = String(randomInt(100000, 1000000))
  issueCode(email, session, code)

  const html = renderEmail({
    title: 'Your verification code',
    bodyHtml:
      // No inline color on the lead/hint <p> → they inherit `.body-ink` (light
      // #404040 / dark #d4d4d4). The code uses `.ink` (light #0a0a0a / dark
      // #fafafa) so it stays readable in both themes. Classes win in dark mode
      // via the template's `!important` overrides.
      '<p style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">' +
      'Use this code to complete your registration:</p>' +
      `<p class="ink" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#0a0a0a;margin:16px 0;">${code}</p>` +
      '<p class="muted" style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#737373;">This code expires in 10 minutes. If you didn’t request it, you can ignore this email.</p>',
    preheader: `Your verification code is ${code}`,
  })

  try {
    await sendMailWithConfig(cfg, {
      to: email,
      subject: 'Your verification code',
      body: html,
      html: true,
    })
  } catch (e) {
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'Failed to send code',
    })
  }

  return { ok: true }
})
