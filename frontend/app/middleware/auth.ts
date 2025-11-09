import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAuth()

  // Public routes that don't require authentication
  const publicRoutes = ['/login']

  // If route is public, allow access
  if (publicRoutes.includes(to.path)) {
    // If already authenticated, redirect to home
    if (isAuthenticated.value) {
      return navigateTo('/')
    }
    return
  }

  // Protected routes - redirect to login if not authenticated
  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
