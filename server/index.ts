import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api } from "./routes";
import { initSchema } from "./db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8081;
const isProd = process.env.NODE_ENV === "production";

async function main() {
  const app = express();
  app.use(express.json());

  // JSON API first, so it always wins over the SPA fallback below.
  app.use("/api", api);

  if (isProd) {
    // In production this file lives at dist/index.mjs and the built client is
    // in dist/public — serve it as static assets with an SPA fallback.
    const publicDir = path.resolve(__dirname, "public");
    app.use(express.static(publicDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  } else {
    // In development, run Vite in middleware mode so the whole app is one
    // process on one port with hot module reloading.
    const { createServer } = await import("vite");
    const vite = await createServer({
      root: path.resolve(__dirname, ".."),
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  try {
    await initSchema();
    console.log("[music-practice] database schema ready");
  } catch (err) {
    console.error(
      "[music-practice] could not initialize the database. Is DATABASE_URL set?",
      err,
    );
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[music-practice] listening on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
