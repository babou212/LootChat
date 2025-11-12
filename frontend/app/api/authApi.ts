import { API_CONFIG } from '../utils/apiConfig'

export const createAuthFetch = (token: string) => {
  return $fetch.create({
    baseURL: API_CONFIG.BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
}
