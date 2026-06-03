import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["dotenv", "undici", "http-proxy-agent", "https-proxy-agent"],
    shims: true,
    outDir: "dist",
    outExtension({ format }) {
      return { js: format === "cjs" ? ".cjs" : ".js" };
    },
  },
  {
    entry: ["src/register.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    external: ["dotenv", "undici", "http-proxy-agent", "https-proxy-agent"],
    shims: true,
    outDir: "dist",
    outExtension() {
      return { js: ".js" };
    },
  },
]);
