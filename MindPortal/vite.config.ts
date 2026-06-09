import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, readdirSync } from "fs";

// Simple plugin to copy static extension files after build
function copyExtensionFiles(): import("vite").Plugin {
  return {
    name: "copy-extension-files",
    closeBundle() {
      // Copy manifest.json
      copyFileSync("manifest.json", "dist/manifest.json");

      // Copy icons
      mkdirSync("dist/assets/icons", { recursive: true });
      for (const file of readdirSync("src/assets/icons")) {
        copyFileSync(`src/assets/icons/${file}`, `dist/assets/icons/${file}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [copyExtensionFiles()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
        "content-script": resolve(__dirname, "src/content/content-script.ts"),
        popup: resolve(__dirname, "src/popup/index.html"),
        options: resolve(__dirname, "src/options/index.html"),
        onboarding: resolve(__dirname, "src/onboarding/index.html"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "service-worker") return "background/service-worker.js";
          if (chunk.name === "content-script") return "content/content-script.js";
          return "[name]/[name].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
    target: "chrome110",
    minify: false,
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
});
