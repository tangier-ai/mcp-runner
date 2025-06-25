import { Module } from "@nestjs/common";
import { DeploymentService } from "../app/deployment/deployment.service";
import { StreamableHttpMcpServerController } from "./streamable-http-mcp-server.controller";
import { StreamableHttpMcpServerService } from "./streamable-http-mcp-server.service";

@Module({
  controllers: [StreamableHttpMcpServerController],
  providers: [StreamableHttpMcpServerService, DeploymentService],
})
export class StreamableHttpMcpServerModule {}
