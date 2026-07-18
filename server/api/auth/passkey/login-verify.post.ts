import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, WebAuthnCredential } from '@simplewebauthn/server'
import { AppDataSource } from '#server/utils/database'
import { User } from '#server/entities/user.entity'
import { Passkey } from '#server/entities/passkey.entity'
import { signTrustJwt, setTrustCookie, getTrustWindowMs } from '#server/utils/jwt'
import {
  bufferToUint8,
  clearChallengeCookie,
  getChallengeCookie,
  getRelyingParty,
  parseTransports,
} from '#server/utils/webauthn'

/**
 * Verify a discoverable-login response: look up the credential by the id in the
 * response, verify its signature against the stored public key, then start a
 * server session for the credential's owner (same shape as password login).
 */
export default defineEventHandler(async (event) => {
  const { rpID, origin } = getRelyingParty(event)

  const body = await readBody<AuthenticationResponseJSON>(event)
  const expectedChallenge = getChallengeCookie(event)
  if (!expectedChallenge) {
    clearChallengeCookie(event)
    throw createError({ statusCode: 400, statusMessage: 'Missing or expired challenge' })
  }

  const repo = AppDataSource.getRepository(Passkey)
  const passkey = await repo.findOne({ where: { credentialId: body?.id ?? '' } })
  if (!passkey) {
    clearChallengeCookie(event)
    throw createError({ statusCode: 401, statusMessage: 'Unknown credential' })
  }

  const credential: WebAuthnCredential = {
    id: passkey.credentialId,
    publicKey: bufferToUint8(passkey.publicKey),
    counter: passkey.counter,
    transports: parseTransports(passkey.transports),
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential,
      requireUserVerification: false,
    })
    if (!verification.verified) throw new Error('Authentication could not be verified')

    // Clone-detection counter — always incrementing; persist the new value.
    await repo.update(passkey.id, { counter: verification.authenticationInfo.newCounter })

    const user = await AppDataSource.getRepository(User).findOneBy({ id: passkey.userId })
    if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

    await createSession(event, user.id)
    const trustedUntil = new Date(Date.now() + getTrustWindowMs())
    await AppDataSource.getRepository(User).update(user.id, { trustedUntil })
    setTrustCookie(event, signTrustJwt(user.id, user.email, trustedUntil))

    return { user: { id: user.id, email: user.email, role: user.role } }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw createError({ statusCode: 400, statusMessage: message })
  } finally {
    clearChallengeCookie(event)
  }
})
