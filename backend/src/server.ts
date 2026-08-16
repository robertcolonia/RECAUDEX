import { app } from "./app.js";
import { prisma } from "./config/database.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`RECAUDEX API disponible en http://${env.HOST}:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal}: cerrando conexiones...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
