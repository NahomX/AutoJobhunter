// ESLint v9 flat config for the Barrio Logan Guest Concierge Next.js app.
// eslint-config-next ships a flat config array — import and spread it.
const nextConfig = require("eslint-config-next");

module.exports = [
  ...nextConfig,
  {
    // Allow unused vars prefixed with _ (conventional placeholder pattern)
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
