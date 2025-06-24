import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { resolve } from "path";
import { srcRoot } from "../../srcRoot";
import { StreamableHttpMcpServerModule } from "../http-streamable/streamable-http-mcp-server.module";
import { SSEMcpServerModule } from "../sse/sse-mcp-server.module";
import { AppController } from "./app.controller";
import { ContainerController } from "./container/container.controller";
import { ContainerService } from "./container/container.service";
import { DeploymentController } from "./deployment/deployment.controller";
import { DeploymentService } from "./deployment/deployment.service";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: resolve(srcRoot, "../", "public").replace("/dist", ""),
      exclude: ["/api/{*test}"],
      serveStaticOptions: {
        fallthrough: false,
      },
    }),
    SSEMcpServerModule,
    StreamableHttpMcpServerModule,
  ],
  controllers: [
    AppController,
    HealthController,
    ContainerController,
    DeploymentController,
  ],
  providers: [ContainerService, DeploymentService],
})
export class AppModule {}
