import { defineConfig, ProxyOptions } from 'vite';

const target: ProxyOptions = {
    target: 'http://localhost:2333',
    ws: true,
    changeOrigin: false,
};

// https://vitejs.dev/config/
export default defineConfig({
    root: 'frontend',
    server: {
        proxy: {
            '/paintboard/conn/websocket': target,
            '/paintboard/conn': target,
            '/api': target,
        },
    },
    build: {
        outDir: '../public',
        emptyOutDir: true,
    },
});
