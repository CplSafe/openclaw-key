import { defineConfig } from "vite";
import { wasp } from "wasp/client/vite";
import path from "path";


export default defineConfig(({ mode }) => {
  // 从环境变量获取 API URL，构建时注入
  const apiUrl = process.env.VITE_API_BASE_URL || "http://localhost:3001";

  return {
    plugins: [wasp()],
    define: {
      // 将 API URL 注入到前端代码中
      "process.env.REACT_APP_API_URL": JSON.stringify(apiUrl),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      open: false,
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  };
});
