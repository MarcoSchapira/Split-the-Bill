import dotenv from "dotenv";
import app from "./app";

dotenv.config();

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
