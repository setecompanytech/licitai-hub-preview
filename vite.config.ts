import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
const BUILD_ID = `${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`;

export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://uwtyuwktxalnpgrcbbgk.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify('uwtyuwktxalnpgrcbbgk'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3dHl1d2t0eGFsbnBncmNiYmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTI5NjEsImV4cCI6MjA5NTQ4ODk2MX0.czjUoTkYoy0jxJcmaBGmiNposNrtcvL_wjUo-rMrqk8'),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace', 'console.warn'],
      },
      mangle: {
        safari10: true,
        properties: {
          regex: /^_private/,
        },
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-ui": ["lucide-react"],
          "vendor-charts": ["recharts"],
          "vendor-motion": ["framer-motion"],
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
}));
