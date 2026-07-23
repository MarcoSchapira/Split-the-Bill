import "dotenv/config";
import app from "./app";
import { assertJwtConfiguration } from "./auth/jwt";
import { assertProductionConfiguration } from "./config";
import { assertDatabaseRoleConfiguration } from "./db/verifyDbRoles";
import { safeLogError } from "./http/safeLogError";

const PORT = process.env.PORT ?? 3000;

async function start(): Promise<void> {
  assertJwtConfiguration();
  assertProductionConfiguration();
  await assertDatabaseRoleConfiguration();

  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  safeLogError("API server failed to start", error);
  process.exit(1);
});
