import "./instrument";

import { API_KEY } from "@/api-key";
import { migrateDb } from "@/migrate";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  migrateDb();

  const expressAdapter = new ExpressAdapter();

  const app = await NestFactory.create(AppModule, expressAdapter);
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle("Tangier MCP Runner API")
    .setDescription("The API for controlling the Tangier MCP Runner")
    .setVersion("0.0.1")
    .addApiKey(
      {
        type: "apiKey",
        name: "X-API-Key",
        in: "header",
        description: "API key for runner authentication",
      },
      "api-key",
    )
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("/api", app, documentFactory, {
    ui: true,
    customSiteTitle: "Tangier MCP Runner API",
    customfavIcon: "/icon.svg",
    customCssUrl: "/swagger.css",
    swaggerOptions: {},
  });

  await app.listen(
    process.env.PORT ?? 3000,

    // by default do not bind to external interface
    process.env.BIND_IP || "127.0.0.1",
  );
}
bootstrap().then(() => {
  if (!process.env.API_KEY) {
    console.warn(
      "No API_KEY environment variable provided. One was generated for you: " +
        API_KEY,
    );
  }
});
