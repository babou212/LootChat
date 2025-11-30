// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/mdc',
    '@pinia/nuxt',
    'nuxt-auth-utils',
    'nuxt-charts',
    '@nuxt/image'
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

  mdc: {
    headings: {
      anchorLinks: false
    },
    highlight: {
      // noApiRoute: true
      shikiEngine: 'javascript'
    }
  },

  runtimeConfig: {
    session: {
      name: 'lootchat-session',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      password: process.env.NUXT_SESSION_PASSWORD || '',
      cookie: {
        sameSite: 'lax',
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

  experimental: {
    viewTransition: true
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    experimental: {
      openAPI: true
    },
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': [
            'default-src \'self\'',
            'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'',
            'style-src \'self\' \'unsafe-inline\'',
            'img-src \'self\' data: https: blob:',
            'font-src \'self\' data:',
            // LiveKit WebSocket signaling goes through localhost (Docker port forward)
            // WebRTC media uses LAN IP but that's handled by ICE, not CSP
            'connect-src \'self\' http://localhost:8080 ws://localhost:8080 http://localhost:7880 ws://localhost:7880 ws: wss: https://tenor.googleapis.com',
            'media-src \'self\' https: blob:',
            'frame-src \'self\' https://www.youtube.com https://www.youtube-nocookie.com',
            'worker-src \'self\' blob:',
            'object-src \'none\'',
            'base-uri \'self\'',
            'form-action \'self\'',
            'frame-ancestors \'none\'',
            'upgrade-insecure-requests'
          ].join('; '),
          'Permissions-Policy': [
            'microphone=(self)',
            'camera=(self)',
            'geolocation=(self)',
            'payment=()',
            'usb=()',
            'magnetometer=()',
            'gyroscope=()',
            'accelerometer=()',
            'ambient-light-sensor=()',
            'autoplay=()',
            'encrypted-media=()',
            'fullscreen=(self)',
            'picture-in-picture=(self)'
          ].join(', '),
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
      }
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
  }
})
