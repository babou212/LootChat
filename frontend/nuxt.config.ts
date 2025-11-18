// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/mdc',
    '@pinia/nuxt',
    'nuxt-auth-utils',
    'nuxt-charts'
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
    public: {
      tenorApiKey: process.env.NUXT_PUBLIC_TENOR_API_KEY,
      // Client-side API URL (external/public)
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:8080',
      // WebRTC ICE/TURN configuration (comma-separated TURN URLs, e.g. "turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349")
      webrtcTurnUrls: process.env.NUXT_PUBLIC_WEBRTC_TURN_URLS || '',
      webrtcTurnUsername: process.env.NUXT_PUBLIC_WEBRTC_TURN_USERNAME || '',
      webrtcTurnCredential: process.env.NUXT_PUBLIC_WEBRTC_TURN_CREDENTIAL || '',
      // Set to 'relay' to force TURN-only; default 'all'
      webrtcIceTransportPolicy: (process.env.NUXT_PUBLIC_WEBRTC_ICE_TRANSPORT_POLICY || 'all') as 'all' | 'relay'
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
            'connect-src \'self\' ws: wss: https://tenor.googleapis.com',
            'media-src \'self\' https:',
            'frame-src \'self\' https://www.youtube.com https://www.youtube-nocookie.com',
            'worker-src \'self\' blob:',
            'object-src \'none\'',
            'base-uri \'self\'',
            'form-action \'self\'',
            'frame-ancestors \'none\'',
            'upgrade-insecure-requests'
          ].join('; ')
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
  }
})
