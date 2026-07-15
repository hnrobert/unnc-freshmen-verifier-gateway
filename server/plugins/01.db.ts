import { initDataSource } from '../utils/database'

export default defineNitroPlugin(async () => {
  await initDataSource()
})
