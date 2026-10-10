import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'./',build:{outDir:'预览',chunkSizeWarningLimit:1800},server:{strictPort:true}});
