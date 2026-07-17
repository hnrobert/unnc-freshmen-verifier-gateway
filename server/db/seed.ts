/**
 * Seed a demo user + org. Run: pnpm db:seed
 *   email: demo@example.com  password: demo1234  org slug: demo
 */
import { AppDataSource, initDataSource, closeDataSource } from '../utils/database'
import { User } from '../entities/user.entity'
import { Organization } from '../entities/organization.entity'
import { OrgSetting } from '../entities/orgSetting.entity'
import { hashPassword } from '../utils/auth'
import defaultConfig from '../../shared/lib/defaultConfig'
import type { SiteConfig } from '../../shared/types'

async function main(): Promise<void> {
  await initDataSource()

  const userRepo = AppDataSource.getRepository(User)
  const orgRepo = AppDataSource.getRepository(Organization)
  const settingRepo = AppDataSource.getRepository(OrgSetting)

  const email = 'demo@example.com'
  let user = await userRepo.findOne({ where: { email } })
  if (!user) {
    const userCount = await userRepo.count()
    user = await userRepo.save({
      email,
      passwordHash: hashPassword('demo1234'),
      role: userCount === 0 ? 'superadmin' : 'admin',
    })
    console.log(`created user ${email} (password: demo1234, role: ${user.role})`)
  } else {
    console.log(`user ${email} already exists`)
  }

  const slug = 'demo'
  let org = await orgRepo.findOne({ where: { slug } })
  if (!org) {
    org = await orgRepo.save({ ownerId: user.id, slug, name: 'Demo Org' })
    console.log(`created org "${slug}"`)
  } else {
    console.log(`org "${slug}" already exists`)
  }

  const cfg = structuredClone(defaultConfig) as SiteConfig
  ;(cfg.messages.zh as { brand: { title: string } }).brand.title = 'Demo Org'
  ;(cfg.messages.en as { brand: { title: string } }).brand.title = 'Demo Org'
  const existing = await settingRepo.findOne({ where: { orgId: org.id } })
  if (existing) {
    existing.config = JSON.stringify(cfg)
    await settingRepo.save(existing)
  } else {
    await settingRepo.save({ orgId: org.id, config: JSON.stringify(cfg) })
  }
  console.log(`seeded org_settings for "${slug}"`)

  await closeDataSource()
  console.log('done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
