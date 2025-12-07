export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch: fetchSession } = useUserSession()

  const publicRoutes = new Set([
    '/login',
    '/forgot-password',
    '/forgot-password/verify',
    '/forgot-password/reset'
  ])

  const isPublic = publicRoutes.has(to.path) || to.path.startsWith('/invite/')

  await fetchSession()

  if (isPublic) {
    if (loggedIn.value && to.path === '/login') {
      return navigateTo('/')
    }
    return
  }

  if (!loggedIn.value) {
    const redirect = to.fullPath !== '/' ? to.fullPath : undefined
    return navigateTo({
      path: '/login',
      query: redirect ? { redirect } : undefined
    })
  }
})
