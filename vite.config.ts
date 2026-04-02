
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
  import tailwindcss from '@tailwindcss/vite';
  import path from 'path';

  export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'sonner@2.0.3': 'sonner',
        'react-hook-form@7.55.0': 'react-hook-form',
        'figma:asset/dda2b55756c309844e1fc5ede28e6761b94507fc.png': path.resolve(__dirname, './src/assets/dda2b55756c309844e1fc5ede28e6761b94507fc.png'),
        'figma:asset/a9436492f49567c6b6a3ffc8716801ff6ec889b7.png': path.resolve(__dirname, './src/assets/a9436492f49567c6b6a3ffc8716801ff6ec889b7.png'),
        'figma:asset/9629fead25325f145d994cd3972f7bb8cabc3b4e.png': path.resolve(__dirname, './src/assets/9629fead25325f145d994cd3972f7bb8cabc3b4e.png'),
        'figma:asset/5bd0f85444d9f77271656b5be7fa3c91c10a9579.png': path.resolve(__dirname, './src/assets/5bd0f85444d9f77271656b5be7fa3c91c10a9579.png'),
        'figma:asset/13999075da141928723b8c42fbe1a97dc4a5be20.png': path.resolve(__dirname, './src/assets/13999075da141928723b8c42fbe1a97dc4a5be20.png'),
        '@jsr/supabase__supabase-js@2.49.8': '@jsr/supabase__supabase-js',
        '@jsr/supabase__supabase-js@2': '@jsr/supabase__supabase-js',
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
    },
    server: {
      port: 3000,
      open: true,
    },
  });