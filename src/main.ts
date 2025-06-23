import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./modules/app/app.module";

async function bootstrap() {
  const expressAdapter = new ExpressAdapter();

  const app = await NestFactory.create(AppModule, expressAdapter);
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle("Tangier MCP Runner API")
    .setDescription("The API for controlling the Tangier MCP Runner")
    .setVersion("0.0.1")
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("/api", app, documentFactory, {
    ui: true,
    customSiteTitle: "Tangier MCP Runner API",
    customfavIcon: "/icon.svg",
    customCssUrl: "/swagger.css",
    swaggerOptions: {},
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
