import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PrismaClient } from "@prisma/client";
import { runStartupMigrations } from "./startup-migrations";

async function bootstrap() {
  const prisma = new PrismaClient();
  await runStartupMigrations(prisma);
  await prisma.$disconnect();

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();