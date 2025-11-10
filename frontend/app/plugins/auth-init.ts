export default defineNuxtPlugin(async () => {
  const { restore } = useAuth()
  await restore()
})
