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

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { isAuthenticated, user, restore, logout } = useAuth()

  const publicRoutes = new Set<string>(['/login'])
  const meta = to.meta as PublicRouteMeta
  const isPublic = publicRoutes.has(to.path) || meta.public === true

  if (isPublic) {
    if (isAuthenticated.value && to.path === '/login') {
      return navigateTo('/')
    }
    return
  }

  if (!isAuthenticated.value) {
    await restore()
  }

  if (!isAuthenticated.value) {
    const redirectPath = to.fullPath
    const safeRedirect = isAllowedRedirect(redirectPath) ? redirectPath : '/'
    return navigateTo({ path: '/login', query: { redirect: safeRedirect } })
  }

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
