import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("/api");

  const config = new DocumentBuilder()
    .setTitle("Tangier MCP Runner API")
    .setDescription("The API for controlling the Tangier MCP Runner")
    .setVersion("0.0.1")
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("/", app, documentFactory, {
    ui: true,
    customSiteTitle: "Tangier MCP Runner API",
    customfavIcon: "/icon.svg",
    customCssUrl: "/swagger.css",
    swaggerOptions: {},
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
