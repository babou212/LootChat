/**
 * Authentication middleware
 *
 * Simple, secure auth check:
 * 1. Check if user is logged in via nuxt-auth-utils session
 * 2. Redirect to login if not authenticated on protected routes
 * 3. Redirect to home if authenticated on login page
 *
 * The session cookie handles expiration automatically (7 days).
 * JWT token refresh is handled by server middleware.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch: fetchSession } = useUserSession()

  // Public routes that don't require authentication
  const publicRoutes = new Set([
    '/login',
    '/forgot-password',
    '/forgot-password/verify',
    '/forgot-password/reset'
  ])

  // Check if route is public (exact match or starts with /invite/)
  const isPublic = publicRoutes.has(to.path) || to.path.startsWith('/invite/')

  // On client-side, ensure session is fetched
  if (import.meta.client) {
    await fetchSession()
  }

  // Handle public routes
  if (isPublic) {
    // Redirect logged-in users away from login page
    if (loggedIn.value && to.path === '/login') {
      return navigateTo('/')
    }
    return
  }

  // Protected route - require authentication
  if (!loggedIn.value) {
    // Store the intended destination for redirect after login
    const redirect = to.fullPath !== '/' ? to.fullPath : undefined
    return navigateTo({
      path: '/login',
      query: redirect ? { redirect } : undefined
    })
  }
})
