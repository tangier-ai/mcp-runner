import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AppController } from "./app.controller";
import { ContainerController } from "./container/container.controller";
import { ContainerService } from "./container/container.service";
import { HealthController } from "./health/health.controller";
import { StreamableHttpMcpServerModule } from "./mcp-server/http-streamable/streamable-http-mcp-server.module";
import { SSEMcpServerModule } from "./mcp-server/sse/sse-mcp-server.module";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "../..", "public"),
      exclude: ["/api/{*test}"],
      serveStaticOptions: {
        fallthrough: false,
      },
    }),
    SSEMcpServerModule,
    StreamableHttpMcpServerModule,
  ],
  controllers: [AppController, HealthController, ContainerController],
  providers: [ContainerService],
})
export class AppModule {}
