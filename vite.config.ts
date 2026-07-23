import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const reactPath = path.resolve(__dirname, 'node_modules/react');
  const reactDomPath = path.resolve(__dirname, 'node_modules/react-dom');

  // Opt-in, QA-only mock backend: when VITE_USE_MOCK_BACKEND=true (via
  // shell env or .env.local), redirect the single module path
  // '@/integrations/supabase/client' to the mock client instead. This never
  // touches the real (generated) client.ts and never affects a normal
  // build/dev run where the flag is unset. Read via loadEnv (which also
  // picks up .env.local) with a process.env fallback for plain
  // `VITE_USE_MOCK_BACKEND=true npm run dev` shell invocations.
  const env = loadEnv(mode, process.cwd(), '');
  const useMockBackend = env.VITE_USE_MOCK_BACKEND === 'true' || process.env.VITE_USE_MOCK_BACKEND === 'true';

  return {
    base: '/',
    define: {
      global: 'globalThis',
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.svg', 'logo.png', 'icon-96x96.png', 'icon-192x192.png', 'icon-512x512.png', 'robots.txt'],
        // manifest is served statically from public/manifest.json (linked in index.html) — disable
        // generation here so there's only one manifest, not two competing ones.
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24
                }
              }
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'supabase-storage-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 7
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: false
        }
      })
    ].filter(Boolean),
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
      chunkSizeWarningLimit: 2000,
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'terser' : false,
      terserOptions: mode === 'production' ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      } : undefined,
      cssCodeSplit: true,
    },
    resolve: {
      // Array form so the specific mock-client override (when enabled) is
      // matched before the generic "@" prefix rule — object-form aliases
      // would need careful key ordering to guarantee the same thing, and
      // array form makes the precedence explicit and easy to verify.
      alias: [
        ...(useMockBackend
          ? [
              {
                find: '@/integrations/supabase/client',
                replacement: path.resolve(__dirname, './src/integrations/supabase/mockClient.ts'),
              },
            ]
          : []),
        { find: '@', replacement: path.resolve(__dirname, './src') },
        { find: 'react', replacement: path.resolve(__dirname, 'node_modules/react') },
        { find: 'react-dom', replacement: path.resolve(__dirname, 'node_modules/react-dom') },
      ],
      dedupe: ['react', 'react-dom', 'react-i18next', 'i18next', '@tanstack/react-query'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router-dom',
        '@supabase/supabase-js',
        '@tanstack/react-query',
      ],
      exclude: [
        '@tensorflow/tfjs',
        '@tensorflow-models/universal-sentence-encoder',
      ],
      force: true,
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' }
    },
  };
});
