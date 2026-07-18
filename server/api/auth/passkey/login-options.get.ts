import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { getRelyingParty, setChallengeCookie } from '../../../utils/webauthn'

/**
 * Authentication options for passwordless login. `allowCredentials: []` makes
 * this a discoverable (usernameless) ceremony — the browser offers any of the
 * visitor's passkeys for this RP, and the chosen credential's id tells us which
 * account to log in. Challenge is stored in a signed cookie (read in login-verify).
 */
export default defineEventHandler(async (event) => {
  const { rpID } = getRelyingParty(event)
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [],
    userVerification: 'preferred',
  })
  setChallengeCookie(event, options.challenge)
  return options
})
