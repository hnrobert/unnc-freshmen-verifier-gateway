import { verifyRegistrationResponse } from '@simplewebauthn/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { AppDataSource } from '../../../utils/database'
import { Passkey } from '../../../entities/passkey.entity'
import { clearChallengeCookie, getChallengeCookie, getRelyingParty } from '../../../utils/webauthn'

/**
 * Verify the browser's registration response and store the new credential.
 * The signed challenge cookie is consumed here and always cleared (replay
 * protection). The credential id is globally unique; if it somehow already
 * belongs to another account we refuse rather than hijack it.
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const { rpID, origin } = getRelyingParty(event)

  const body = await readBody<RegistrationResponseJSON>(event)
  const expectedChallenge = getChallengeCookie(event)
  if (!expectedChallenge) {
    clearChallengeCookie(event)
    throw createError({ statusCode: 400, statusMessage: 'Missing or expired challenge' })
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    })
    if (!verification.verified || !verification.registrationInfo)
      throw new Error('Registration could not be verified')

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

    const repo = AppDataSource.getRepository(Passkey)
    const existing = await repo.findOne({ where: { credentialId: credential.id } })
    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: existing.userId === me.id
          ? 'Credential already registered'
          : 'Credential already registered to another account',
      })
    }

    const saved = await repo.save({
      userId: me.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ? JSON.stringify(credential.transports) : null,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    })

    return {
      verified: true,
      passkey: {
        id: saved.id,
        nickname: saved.nickname,
        deviceType: saved.deviceType,
        createdAt: saved.createdAt,
      },
    }
  } catch (error) {
    // Preserve h3 errors (e.g. the 409 above); wrap everything else as 400.
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw createError({ statusCode: 400, statusMessage: message })
  } finally {
    clearChallengeCookie(event)
  }
})
