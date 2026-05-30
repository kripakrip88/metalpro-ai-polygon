import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient } from "@prisma/client";
import { json, urlencoded } from "express";
import { runStartupMigrations } from "./startup-migrations";

async function bootstrap() {
  const prisma = new PrismaClient();
  await runStartupMigrations(prisma);
  await prisma.$disconnect();

  const app = await NestFactory.create(AppModule);

  // Increase body parser limits — default 100KB is too small for file uploads via JSON
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));

  app.enableCors();
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
