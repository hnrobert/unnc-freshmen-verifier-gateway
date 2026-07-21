import { initDataSource } from '#server/utils/database'

export default defineNitroPlugin(async () => {
  await initDataSource()
})
