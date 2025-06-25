import { Module } from "@nestjs/common";
import { DeploymentService } from "../app/deployment/deployment.service";
import { SSEMcpServerController } from "./sse-mcp-server.controller";
import { SSEMcpServerService } from "./sse-mcp-server.service";

@Module({
  controllers: [SSEMcpServerController],
  providers: [SSEMcpServerService, DeploymentService],
})
export class SSEMcpServerModule {}
