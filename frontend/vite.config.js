var _a;
/// <reference types="vitest" />
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var devProxyTarget = (_a = process.env.VITE_DEV_PROXY_TARGET) !== null && _a !== void 0 ? _a : 'http://localhost:4000';
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: devProxyTarget,
                changeOrigin: true,
            },
            '/socket.io': {
                target: devProxyTarget,
                changeOrigin: true,
                ws: true,
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
    },
});
