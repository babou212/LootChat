import { useAuth } from '~/composables/useAuth'
import type { RouteLocationNormalized } from 'vue-router'

interface PublicRouteMeta { public?: boolean }

// Whitelist of allowed redirect paths to prevent open redirect vulnerabilities
const isAllowedRedirect = (path: string): boolean => {
  if (!path) return false
  // Only allow internal paths
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
    return false
  }
  // Must start with /
  return path.startsWith('/')
}

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { isAuthenticated, user, restore } = useAuth()

  const publicRoutes = new Set<string>(['/login'])
  const meta = to.meta as PublicRouteMeta
  const isPublic = publicRoutes.has(to.path) || meta.public === true

  // Allow access to public routes
  if (isPublic) {
    // If already authenticated, redirect to home
    if (isAuthenticated.value && to.path === '/login') {
      return navigateTo('/')
    }
    return
  }

  // Try to restore session if not authenticated
  if (!isAuthenticated.value) {
    await restore()
  }

  // Redirect to login if still not authenticated
  if (!isAuthenticated.value) {
    const redirectPath = to.fullPath
    // Validate redirect parameter to prevent open redirect
    const safeRedirect = isAllowedRedirect(redirectPath) ? redirectPath : '/'
    return navigateTo({ path: '/login', query: { redirect: safeRedirect } })
  }

  // Validate route params match authenticated user (e.g., /profile/:username)
  const routeUsername = (to.params?.username as string | undefined) || undefined
  if (routeUsername) {
    const currentUsername = user.value?.username
    if (!currentUsername || currentUsername !== routeUsername) {
      // User trying to access someone else's protected route
      return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  }
})
