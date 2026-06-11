import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

type RoleCheckRow = {
  rolname: string;
  rolbypassrls: boolean;
};

export async function verifyAppDatabaseRole(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  try {
    const result = await pool.query<RoleCheckRow>(
      "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user",
    );
    const role = result.rows[0];

    if (!role) {
      throw new Error("Unable to determine current database role for DATABASE_URL");
    }

    if (role.rolbypassrls) {
      throw new Error(
        `DATABASE_URL role "${role.rolname}" has BYPASSRLS; use a restricted app role for runtime queries`,
      );
    }
  } finally {
    await pool.end();
  }
}

export async function assertDatabaseRoleConfiguration(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  if (process.env.NODE_ENV === "production") {
    if (!directUrl) {
      throw new Error("DIRECT_URL is required in production for privileged database operations");
    }

    if (directUrl === databaseUrl) {
      throw new Error("DIRECT_URL must differ from DATABASE_URL in production");
    }

    await verifyAppDatabaseRole(databaseUrl);
    return;
  }

  if (directUrl && directUrl === databaseUrl) {
    console.warn(
      "WARNING: DATABASE_URL and DIRECT_URL are identical; RLS bypass risk in local/test setups",
    );
  }
}

export function createAdminConnectionString(): string {
  const directUrl = process.env.DIRECT_URL;

  if (process.env.NODE_ENV === "production") {
    if (!directUrl) {
      throw new Error("DIRECT_URL is required in production");
    }
    return directUrl;
  }

  return directUrl ?? process.env.DATABASE_URL ?? "";
}

export function createAdminAdapter() {
  return new PrismaPg({ connectionString: createAdminConnectionString() });
}
