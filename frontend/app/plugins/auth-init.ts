/**
 * Initialize authentication on app startup
 * nuxt-auth-utils automatically handles session restoration,
 * but we call restore() to ensure any custom logic is executed
 */
export default defineNuxtPlugin(async () => {
  const { restore } = useAuth()
  await restore()
})
