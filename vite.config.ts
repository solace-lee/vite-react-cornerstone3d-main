import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteCommonjs } from "@originjs/vite-plugin-commonjs"
// import wasm from 'vite-plugin-wasm';
import { wasm } from "@rollup/plugin-wasm";
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { fileURLToPath } from 'url';

export default defineConfig({
  assetsInclude: ["**/*.wasm"],
  plugins: [
    react(),
    // wasm({ sync: ['ICRPolySeg.wasm'] }),
    // wasm(),
    viteCommonjs(),
  ],
  server: {
    host: '0.0.0.0',
  },
  optimizeDeps: {
    exclude: ["@cornerstonejs/dicom-image-loader", "@cornerstonejs/tools"],
    include: ["dicom-parser", "xmlbuilder2"],
  },
  build: {
    target: "es2022",
    rollupOptions: {
      external: ["@icr/polyseg-wasm", "itk-wasm", "@itk-wasm/morphological-contour-interpolation"],
    }
  },
  worker: {
    format: "es",
    plugins: () => [
      // wasm(),
      // wasm({ sync: ['ICRPolySeg'] }),
    ],
  }
})
