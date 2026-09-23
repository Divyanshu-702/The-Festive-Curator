import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'The Festive Curator',
          short_name: 'FestiveCurator',
          description: 'Artisanal digital gift cards designed with the warmth of tradition and modern aesthetics.',
          theme_color: '#d946ef',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=192&auto=format&fit=crop',
              sizes: '192x192',
              type: 'image/jpeg',
              purpose: 'any'
            },
            {
              src: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=512&auto=format&fit=crop',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'any'
            },
            {
              src: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=512&auto=format&fit=crop',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-images-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'motion/react', 'motion'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
