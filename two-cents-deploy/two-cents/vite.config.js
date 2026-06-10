import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoupdate",
      includeAssets: ["icon-180.png"],
      manifest: {
        name: "Two Cents — Private Budget for Two",
        short_name: "Two Cents",
        description: "Private, local-first budgeting for couples. AI statement parsing, smart categorization, savings predictions.",
        theme_color: "#176B4F",
        background_color: "#F3F5F1",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }
    })
  ]
});
