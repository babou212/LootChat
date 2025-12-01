import { useAuth } from '~/composables/useAuth'
import type { RouteLocationNormalized } from 'vue-router'

interface PublicRouteMeta { public?: boolean }

const isAllowedRedirect = (path: string): boolean => {
  if (!path) return false
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
    return false
  }
  return path.startsWith('/')
}

/**
 * Authentication middleware that validates session
 *
 * The middleware:
 * 1. On server: trusts the session from nuxt-auth-utils (it's already validated)
 * 2. On client: fetches session if not ready, then checks auth state
 * 3. Redirects to login if not authenticated
 *
 * JWT validation is handled by the server middleware (auth-refresh.ts)
 * which runs on every request and clears invalid sessions automatically.
 */
export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { loggedIn, ready, fetch: fetchSession } = useUserSession()
  const { user } = useAuth()

  const publicRoutes = new Set<string>(['/login', '/forgot-password', '/forgot-password/verify', '/forgot-password/reset'])
  const meta = to.meta as PublicRouteMeta
  const isPublic = publicRoutes.has(to.path) || meta.public === true

  // On server-side during SSR, the nuxt-auth-utils plugin has already fetched the session
  // We can trust the loggedIn state directly
  if (import.meta.server) {
    if (isPublic) {
      if (loggedIn.value && to.path === '/login') {
        return navigateTo('/')
      }
      return
    }

    if (!loggedIn.value) {
      const redirectPath = to.fullPath
      const safeRedirect = isAllowedRedirect(redirectPath) ? redirectPath : '/'
      return navigateTo({ path: '/login', query: { redirect: safeRedirect } })
    }
    return
  }

  // On client-side, fetch session if not ready (handles client-side navigation after SSR)
  if (!ready.value) {
    await fetchSession()
  }

  if (isPublic) {
    // If already logged in and going to login, redirect to home
    if (loggedIn.value && to.path === '/login') {
      return navigateTo('/')
    }
    return
  }

  // Not authenticated - redirect to login
  if (!loggedIn.value) {
    const redirectPath = to.fullPath
    const safeRedirect = isAllowedRedirect(redirectPath) ? redirectPath : '/'
    return navigateTo({ path: '/login', query: { redirect: safeRedirect } })
  }

  // Check route username if present
  const routeUsername = (to.params?.username as string | undefined) || undefined
  if (routeUsername) {
    const currentUsername = user.value?.username
    if (!currentUsername || currentUsername !== routeUsername) {
      const redirectPath = to.path === '/login' ? '/' : to.fullPath
      const safeRedirect = isAllowedRedirect(redirectPath) ? redirectPath : '/'
      return navigateTo({ path: '/login', query: { redirect: safeRedirect } })
    }
  }
})
