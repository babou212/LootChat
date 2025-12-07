export default defineNuxtPlugin(() => {
  const { getCsrfTokenFromCookie } = useCsrf()

  // Intercept global $fetch to add CSRF token
  const originalFetch = globalThis.$fetch

  globalThis.$fetch = new Proxy(originalFetch, {
    apply(target, thisArg, args: [RequestInfo, RequestInit?]) {
      const [url, options = {}] = args

      // Only add CSRF token for mutating requests to our API
      const method = options.method?.toUpperCase() || 'GET'
      const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

      if (needsCsrf) {
        const token = getCsrfTokenFromCookie()
        if (token) {
          options.headers = {
            ...options.headers,
            'X-XSRF-TOKEN': token
          }
        }
      }

      return Reflect.apply(target, thisArg, [url, options])
    }
  })
})
