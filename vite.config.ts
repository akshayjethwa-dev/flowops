import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
<<<<<<< HEAD
import {defineConfig} from 'vite';
=======
import { defineConfig } from 'vite';
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
<<<<<<< HEAD
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
=======
      // Allow Firebase Auth popups to communicate back to the host window
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
<<<<<<< HEAD
});
=======
});
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
