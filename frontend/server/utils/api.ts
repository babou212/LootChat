/**
 * Get the appropriate API URL for server-side requests
 * Uses internal Docker network URL in production, falls back to public URL in dev
 */
export const getServerApiUrl = () => {
  const config = useRuntimeConfig()
  // Use internal API URL for server-side requests (Docker network)
  // Falls back to public URL for development
  return config.apiUrl || config.public.apiUrl
}
