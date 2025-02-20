import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteCommonjs } from "@originjs/vite-plugin-commonjs"
// import wasm from 'vite-plugin-wasm';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { wasm } from '@rollup/plugin-wasm';
/**
 * Vite configuration for the application.
 *
 * @remarks
 * This configuration is mostly standard Vite + React setup, with specific accommodations for:
 * - WASM decoders used by Cornerstone libraries
 * - DICOM parser which currently uses CommonJS format (planned migration to ESM)
 *
 * @description
 * Key configuration points:
 * - Uses vite-plugin-commonjs to handle the DICOM parser's CommonJS format
 * - Configures worker format as ES modules
 * - Excludes Cornerstone CODEC packages from dependency optimization to handle WASM properly
 * - Explicitly includes dicom-parser in optimization
 * - Ensures WASM files are properly handled as assets
 *
 * @example
 * To use additional WASM decoders, add them to the optimizeDeps.exclude array:
 * ```ts
 * optimizeDeps: {
 *   exclude: [
 *     "@cornerstonejs/codec-new-decoder",
 *     // ... existing codecs
 *   ]
 * }
 * ```
 */
export default defineConfig({
  plugins: [
    react(),
    // for dicom-parser
    viteCommonjs(),
    wasm(),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/@cornerstonejs/tools/dist/esm/workers/polySegConverters.js', dest: './workers/' },
        // { src: 'node_modules/@cornerstonejs/dicom-image-loader/dist/dynamic-import/*.worker.js', dest: '.' },
      ],
    }),
  ],
  server: {
    host: '0.0.0.0',
  },
  // seems like only required in dev mode
  optimizeDeps: {
    exclude: ["@cornerstonejs/dicom-image-loader"],
    include: ["dicom-parser"],
  },
  worker: {
    format: "es",
    plugins: () => [
      wasm({ sync: ['ICRPolySeg.wasm'] }),
    ],
    rollupOptions: {
      external: ["@icr/polyseg-wasm", "itk-wasm", "@itk-wasm/morphological-contour-interpolation"],
    },
  }
})
