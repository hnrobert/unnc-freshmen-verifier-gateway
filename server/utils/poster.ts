/**
 * Server-side re-export of the shared poster helpers — see
 * `shared/lib/poster.ts` (the single home, shared with the client canvas
 * renderer). Relative import: the `#shared` alias isn't reliable inside
 * server/utils for the unimport scanner.
 */
export * from '../../shared/lib/poster'
