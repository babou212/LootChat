// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt',
    'nuxt-auth-utils',
    '@nuxt/image',
    'nuxt-security'
  ],
  devtools: {
    enabled: true
  },

  app: {
    head: {
      link: [
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: '/favicon.ico'
        },
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/favicon.svg'
        }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    session: {
      name: 'lootchat-session',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      password: process.env.NUXT_SESSION_PASSWORD || '',
      cookie: {
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        path: '/'
      }
    },
    oauth: {
      // OAuth providers can be added here if needed in the future
    },
    // Server-side API URL (internal Docker network)
    apiUrl: process.env.NUXT_API_URL || process.env.NUXT_PUBLIC_API_URL || 'http://localhost:8080',
    // LiveKit server-side secrets (never exposed to client)
    livekitApiKey: process.env.NUXT_LIVEKIT_API_KEY || 'devkey',
    livekitApiSecret: process.env.NUXT_LIVEKIT_API_SECRET || 'secret',
    public: {
      tenorApiKey: process.env.NUXT_PUBLIC_TENOR_API_KEY,
      // Client-side API URL (external/public)
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:8080',
      // LiveKit server URL (client needs this to connect)
      livekitUrl: process.env.NUXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880'
    }
  },

  routeRules: {
    '/login': { prerender: true },
    '/forgot-password': { prerender: true },
    '/forgot-password/reset': { prerender: true },
    '/forgot-password/verify': { prerender: true },
    '/invite/**': { ssr: true },
    '/': { ssr: false },
    '/messages': { ssr: false },
    '/profile': { ssr: false },
    '/api/**': { ssr: false }
  },

  experimental: {
    viewTransition: true,
    componentIslands: true,
    payloadExtraction: true
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    experimental: {
      openAPI: true
    },
    compressPublicAssets: true,
    prerender: {
      crawlLinks: false
    }
    // Security headers are now managed by nuxt-security module
  },

  vite: {
    build: {
      // CSS code splitting for smaller bundles per route
      cssCodeSplit: true,
      // Fast minification with esbuild
      minify: 'esbuild',
      // Target modern browsers for smaller bundles
      target: 'esnext'
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  image: {
    provider: 'none',
    domains: ['minio.dylancree.com', 'localhost']
  },

  // nuxt-security module configuration
  security: {
    // Enable nonce-based CSP for Strict CSP
    nonce: true,

    // SSG configuration for static generation
    ssg: {
      meta: true,
      hashScripts: true,
      hashStyles: false, // Styles use 'unsafe-inline' which is acceptable
      nitroHeaders: true,
      exportToPresets: true
    },

    // Enable Subresource Integrity
    sri: true,

    // Rate limiting - disabled as backend handles rate limiting
    // The backend has proper rate limiting on sensitive endpoints (login, password reset)
    rateLimiter: false,

    // Request size limiting
    requestSizeLimiter: {
      maxRequestSizeInBytes: 2000000, // 2MB
      maxUploadFileRequestInBytes: 52428800, // 50MB for file uploads
      throwError: true
    },

    // XSS validation
    xssValidator: {
      throwError: true
    },

    // CORS handler (handled by backend, disable here)
    corsHandler: false,

    // Restrict HTTP methods
    allowedMethodsRestricter: {
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
      throwError: true
    },

    // Hide X-Powered-By header
    hidePoweredBy: true,

    // Remove console.log statements in production
    removeLoggers: true,

    // Security headers
    headers: {
      // Cross-Origin policies
      crossOriginResourcePolicy: 'same-origin',
      crossOriginOpenerPolicy: 'same-origin-allow-popups',
      crossOriginEmbedderPolicy: false, // Disabled to allow YouTube embeds

      // Strict CSP with nonces and strict-dynamic
      contentSecurityPolicy: {
        'base-uri': ['\'none\''],
        'font-src': ['\'self\'', 'data:'],
        'form-action': ['\'self\''],
        'frame-ancestors': ['\'none\''],
        'frame-src': ['\'self\'', 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://youtube.com'],
        'img-src': ['\'self\'', 'data:', 'https:', 'blob:'],
        'media-src': ['\'self\'', 'https:', 'blob:'],
        'object-src': ['\'none\''],
        'script-src-attr': ['\'none\''],
        'style-src': ['\'self\'', '\'unsafe-inline\''], // Styles need unsafe-inline for Vue/Nuxt
        'script-src': [
          '\'self\'',
          '\'strict-dynamic\'', // Allows scripts loaded by trusted scripts
          '\'nonce-{{nonce}}\'', // Nonce-based CSP for inline scripts
          '\'unsafe-eval\'' // Required for Vue's runtime template compiler and some libraries
        ],
        'connect-src': ['\'self\'', 'https:', 'wss:', 'ws:'],
        'worker-src': ['\'self\'', 'blob:'],
        'upgrade-insecure-requests': true
      },

      // Other security headers
      originAgentCluster: '?1',
      referrerPolicy: 'strict-origin-when-cross-origin',
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubdomains: true,
        preload: true
      },
      xContentTypeOptions: 'nosniff',
      xDNSPrefetchControl: 'off',
      xDownloadOptions: 'noopen',
      xFrameOptions: 'DENY',
      xPermittedCrossDomainPolicies: 'none',
      xXSSProtection: '0', // Disabled as recommended for modern browsers

      // Permissions Policy
      permissionsPolicy: {
        'camera': ['self'],
        'microphone': ['self'],
        'geolocation': ['self'],
        'fullscreen': ['self'],
        'picture-in-picture': ['self'],
        'display-capture': ['self'],
        'payment': [],
        'usb': [],
        'magnetometer': [],
        'gyroscope': [],
        'accelerometer': []
      }
    }
  }
})
