// CommonJS so the plugin is required from project root (avoids Turbopack resolution from .next)
const tailwindPlugin = require('@tailwindcss/postcss');

module.exports = {
  plugins: [tailwindPlugin()],
};
