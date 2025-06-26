import { HealthController } from "@/controllers/health.controller";
import { SSEMcpServerController } from "@/controllers/sse-mcp-server.controller";
import { StreamableHttpMcpServerController } from "@/controllers/streamable-http-mcp-server.controller";
import { DeploymentService } from "@/services/deployment.service";
import { SSEMcpServerService } from "@/services/sse-mcp-server.service";
import { StreamableHttpMcpServerService } from "@/services/streamable-http-mcp-server.service";
import { srcRoot } from "@/srcRoot";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { resolve } from "path";
import { AppController } from "./controllers/app.controller";
import { DeploymentController } from "./controllers/deployment.controller";

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
