import "./instrument";

import { API_KEY } from "@/api-key";
import { migrateDb } from "@/migrate";
import { srcRoot } from "@/src-root";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { readFileSync } from "fs";
import { resolve } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  migrateDb();

  const expressAdapter = new ExpressAdapter();

  const app = await NestFactory.create(AppModule, expressAdapter);
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle("Tangier MCP Runner API")
    .setDescription(
      readFileSync(
        resolve(srcRoot, "../", "README.md").replace("/dist", ""),
      ).toString("utf-8"),
    )
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

  SwaggerModule.setup("/swagger", app, documentFactory, {
    ui: true,
    customSiteTitle: "Tangier MCP Runner API",
    customfavIcon: "/icon.svg",
    customCssUrl: "/swagger.css",
    yamlDocumentUrl: "/openapi.yaml",
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
