const fs = require("node:fs");
const path = require("node:path");

const envTestPath = path.join(__dirname, "..", ".env.test");

if (!fs.existsSync(envTestPath)) {
  throw new Error(
    'Missing .env.test. Copy .env.test.example to .env.test, point DATABASE_URL and DIRECT_URL at a dedicated test database (not your dev DB — integration tests wipe all rows), then run npm run test:integration again.',
  );
}

const requiredValues = {
  NODE_ENV: "test",
  ALLOW_TEST_DATABASE_RESET: "true",
};

for (const [name, value] of Object.entries(requiredValues)) {
  if (process.env[name] !== value) {
    throw new Error(
      `Refusing test database operations: ${name} must be explicitly set to "${value}" in .env.test (see .env.test.example).`,
    );
  }
}

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL || !process.env.JWT_SECRET) {
  throw new Error(
    "Refusing test database operations: DATABASE_URL, DIRECT_URL, and JWT_SECRET must be configured in .env.test.",
  );
}
