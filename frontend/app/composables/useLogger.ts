/**
 * Logging Utility
 * 
 * Provides consistent logging across the application with proper formatting
 * and conditional output based on environment
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerOptions {
  prefix?: string
  enableInProduction?: boolean
}

const createLogger = (options: LoggerOptions = {}) => {
  const { prefix = '', enableInProduction = false } = options
  const isDev = process.env.NODE_ENV === 'development'
  const shouldLog = isDev || enableInProduction

  const formatMessage = (level: LogLevel, message: string): string => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    return `[${timestamp}]${prefix ? ` [${prefix}]` : ''} ${message}`
  }

  return {
    debug: (message: string, ...args: unknown[]) => {
      if (shouldLog && isDev) {
        console.log(formatMessage('debug', message), ...args)
      }
    },

    info: (message: string, ...args: unknown[]) => {
      if (shouldLog) {
        console.info(formatMessage('info', message), ...args)
      }
    },

    warn: (message: string, ...args: unknown[]) => {
      if (shouldLog) {
        console.warn(formatMessage('warn', message), ...args)
      }
    },

    error: (message: string, error?: unknown) => {
      // Always log errors, even in production
      console.error(formatMessage('error', message), error)
      
      // In production, you could send to error tracking service
      if (!isDev && typeof window !== 'undefined') {
        // Example: Send to Sentry, LogRocket, etc.
        // Sentry.captureException(error, { extra: { message } })
      }
    }
  }
}

/**
 * WebSocket logger
 */
export const useWebSocketLogger = () => createLogger({ 
  prefix: 'WebSocket' 
})

/**
 * WebRTC/Voice logger
 */
export const useVoiceLogger = () => createLogger({ 
  prefix: 'Voice' 
})

/**
 * General application logger
 */
export const useAppLogger = () => createLogger({ 
  prefix: 'App' 
})

/**
 * API logger
 */
export const useApiLogger = () => createLogger({ 
  prefix: 'API' 
})
