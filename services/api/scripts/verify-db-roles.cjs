require("dotenv/config");

const pg = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });

  try {
    const result = await pool.query(
      "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user",
    );
    const role = result.rows[0];

    if (!role) {
      console.error("Unable to determine current database role");
      process.exit(1);
    }

    if (role.rolbypassrls) {
      console.error(
        `DATABASE_URL role "${role.rolname}" has BYPASSRLS; use a restricted app role for runtime queries`,
      );
      process.exit(1);
    }

    console.log(`Database role "${role.rolname}" is RLS-enforced (BYPASSRLS=false)`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
