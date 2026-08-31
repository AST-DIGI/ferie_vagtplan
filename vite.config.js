import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' gør at appen virker på GitHub Pages uanset repo-navn
export default defineConfig({ base: './', plugins: [react()] });
