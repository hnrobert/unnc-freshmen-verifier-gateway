/**
 * Site-wide constants — the single source of truth for the repo/license/author
 * metadata shared by the footer, homepage, and other surfaces. Import from here
 * instead of re-declaring the same literals per component.
 *
 * (The static `email/template.html` and `README.md` can't import JS, so they
 * keep their own copies of the repo URL as plain text.)
 */

/** Canonical source repository. */
export const SITE_REPO_URL = 'https://github.com/hnrobert/unnc-freshmen-verifier-gateway'

/** License file on the default branch. */
export const SITE_LICENSE_URL = `${SITE_REPO_URL}/blob/main/LICENSE`

/** SPDX license identifier shown in the footer. */
export const SITE_LICENSE = 'Apache-2.0'

/** Human-readable product name (also the footer's home-link label). */
export const SITE_TITLE = 'UNNC Freshmen Verifier Gateway'

/** Maintainer display name + GitHub profile. */
export const SITE_AUTHOR_NAME = 'Robert He'
export const SITE_AUTHOR_URL = 'https://github.com/hnrobert'

/** Maintaining organization GitHub. */
export const SITE_ORG_NAME = 'CompPsyUnion'
export const SITE_ORG_URL = 'https://github.com/CompPsyUnion'
