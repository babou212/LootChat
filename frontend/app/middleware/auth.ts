import { useAuth } from '~/composables/useAuth'
import type { RouteLocationNormalized } from 'vue-router'

interface PublicRouteMeta { public?: boolean }

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  const { isAuthenticated, user, restore } = useAuth()
  const authToken = useCookie<string | null>('auth_token')

  const publicRoutes = new Set<string>(['/login'])
  const meta = to.meta as PublicRouteMeta
  const isPublic = publicRoutes.has(to.path) || meta.public === true

  if (isPublic) return

  if (!isAuthenticated.value && authToken.value) {
    await restore()
  }

  if (!isAuthenticated.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  const routeUsername = (to.params?.username as string | undefined) || undefined
  if (routeUsername) {
    const currentUsername = user.value?.username
    if (!currentUsername || currentUsername !== routeUsername) {
      return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  }
})
