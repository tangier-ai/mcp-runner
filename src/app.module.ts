import { HealthController } from "@/controllers/health.controller";
import { SSEMcpServerController } from "@/controllers/sse-mcp-server.controller";
import { StreamableHttpMcpServerController } from "@/controllers/streamable-http-mcp-server.controller";
import { BaseMcpServerService } from "@/services/base-mcp-server.service";
import { ContainerService } from "@/services/container.service";
import { DeploymentService } from "@/services/deployment.service";
import { LinuxUserService } from "@/services/linux-user.service";
import { NetworkService } from "@/services/network.service";
import { SSEMcpServerService } from "@/services/sse-mcp-server.service";
import { StreamableHttpMcpServerService } from "@/services/streamable-http-mcp-server.service";
import { srcRoot } from "@/src-root";
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { resolve } from "path";
import { AppController } from "./controllers/app.controller";
import { DeploymentController } from "./controllers/deployment.controller";

@Module({
  imports: [
    SentryModule.forRoot(),
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
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },

    BaseMcpServerService,
    ContainerService,
    LinuxUserService,
    NetworkService,
    DeploymentService,
    SSEMcpServerService,
    StreamableHttpMcpServerService,
  ],
})
export class AppModule {}
