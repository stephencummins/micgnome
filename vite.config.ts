import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // The JUCE build fetches JUCE's own examples, test files included, and
    // they are not ours to run.
    exclude: [...configDefaults.exclude, 'plugin/build/**'],
  },
})
