import { z } from 'zod'
import type { H3Event } from 'h3'

export const createChannelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(30, 'Channel name too long'),
  description: z.string().max(100, 'Description too long').optional(),
  channelType: z.enum(['TEXT', 'VOICE']).optional()
})

export const updateChannelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(30, 'Channel name too long').optional(),
  description: z.string().max(500, 'Description too long').optional()
})

export const createMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(10000000, 'Message too long'),
  channelId: z.number().int().positive(),
  messageType: z.enum(['TEXT', 'FILE', 'IMAGE']).optional(),
  replyToMessageId: z.number().int().positive().optional()
})

export const updateMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(100000, 'Message too long')
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(12, 'Password must be at least 12 characters').max(255),
  newPassword: z.string().min(12, 'Password must be at least 12 characters').max(255),
  confirmPassword: z.string().min(12, 'Password must be at least 12 characters').max(255)
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

export const updateUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  email: z.string().email().optional(),
  avatar: z.string().url().optional()
})

/**
 * Helper function to validate request body against a schema
 * Throws a 400 error with validation details if validation fails
 */
export async function validateBody<T>(event: H3Event, schema: z.ZodSchema<T>): Promise<T> {
  const body = await readBody(event)

  try {
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: 'Validation error',
        data: error.issues
      })
    }
    throw error
  }
}
