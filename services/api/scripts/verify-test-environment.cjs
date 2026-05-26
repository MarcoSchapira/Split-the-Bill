const requiredValues = {
  NODE_ENV: "test",
  ALLOW_TEST_DATABASE_RESET: "true",
};

for (const [name, value] of Object.entries(requiredValues)) {
  if (process.env[name] !== value) {
    throw new Error(
      `Refusing test database operations: ${name} must be explicitly set to "${value}" in .env.test.`,
    );
  }
}

if (!process.env.DATABASE_URL || !process.env.DIRECT_URL || !process.env.JWT_SECRET) {
  throw new Error(
    "Refusing test database operations: DATABASE_URL, DIRECT_URL, and JWT_SECRET must be configured in .env.test.",
  );
}
