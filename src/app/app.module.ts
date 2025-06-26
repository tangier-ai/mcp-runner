import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { resolve } from "path";
import { srcRoot } from "../srcRoot";
import { AppController } from "./app.controller";
import { DeploymentController } from "./deployment/deployment.controller";
import { DeploymentService } from "./deployment/deployment.service";
import { HealthController } from "./health/health.controller";
import { StreamableHttpMcpServerController } from "./http-streamable/streamable-http-mcp-server.controller";
import { StreamableHttpMcpServerService } from "./http-streamable/streamable-http-mcp-server.service";
import { SSEMcpServerController } from "./sse/sse-mcp-server.controller";
import { SSEMcpServerService } from "./sse/sse-mcp-server.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: resolve(srcRoot, "../", "public").replace("/dist", ""),
      exclude: ["/api/{*test}"],
      serveStaticOptions: {
        fallthrough: false,
      },
    }),
  ],
  controllers: [
    AppController,
    HealthController,
    DeploymentController,
    SSEMcpServerController,
    StreamableHttpMcpServerController,
  ],
  providers: [
    DeploymentService,
    SSEMcpServerService,
    StreamableHttpMcpServerService,
  ],
})
export class AppModule {}
