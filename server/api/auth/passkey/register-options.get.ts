import { generateRegistrationOptions } from '@simplewebauthn/server'
import { AppDataSource } from '../../../utils/database'
import { User } from '../../../entities/user.entity'
import { Passkey } from '../../../entities/passkey.entity'
import { getRelyingParty, parseTransports, setChallengeCookie, webauthnUserId } from '../../../utils/webauthn'

/**
 * Registration options for adding a passkey to the logged-in account. Stores the
 * challenge in a signed cookie (read back in register-verify). Excludes the
 * user's existing credentials so the same authenticator can't be re-registered.
 */
export default defineEventHandler(async (event) => {
  const me = requireAuth(event)
  const { rpID, rpName } = getRelyingParty(event)

  const user = await AppDataSource.getRepository(User).findOneBy({ id: me.id })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  const existing = await AppDataSource.getRepository(Passkey).find({ where: { userId: me.id } })

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.email,
    userID: webauthnUserId(user.id),
    attestationType: 'none',
    excludeCredentials: existing.map(p => ({
      id: p.credentialId,
      transports: parseTransports(p.transports),
    })),
    authenticatorSelection: {
      residentKey: 'required', // discoverable credential → enables usernameless login
      userVerification: 'preferred',
    },
    // Exclude -8 (Ed25519): avoids known OKP verify errors on some Node/browser combos.
    supportedAlgorithmIDs: [-7, -257],
  })

  setChallengeCookie(event, options.challenge)
  return options
})
