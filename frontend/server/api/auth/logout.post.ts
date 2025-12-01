export default defineEventHandler(async (event) => {
  // Clear the nuxt-auth-utils session
  await clearUserSession(event)

  // Explicitly clear the session cookie with all possible configurations
  // This ensures the cookie is removed regardless of how it was set
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/'
  }

  // Delete the session cookie by setting it to empty with immediate expiry
  deleteCookie(event, 'lootchat-session', cookieOptions)

  // Also try without httpOnly in case there are any client-accessible cookies
  deleteCookie(event, 'lootchat-session', { ...cookieOptions, httpOnly: false })

  return {
    success: true
  }
})
