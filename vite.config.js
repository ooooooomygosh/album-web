import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), wallpaper: fileURLToPath(new URL('./wallpaper.html', import.meta.url)), pet: fileURLToPath(new URL('./pet.html', import.meta.url)) } } }
});
