import "dotenv/config";
import app from "./app";
import { assertJwtConfiguration } from "./auth/jwt";

const PORT = process.env.PORT ?? 3000;

assertJwtConfiguration();

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
