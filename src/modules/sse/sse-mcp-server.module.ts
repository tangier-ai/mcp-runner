import { Module } from "@nestjs/common";
import { SSEMcpServerController } from "./sse-mcp-server.controller";
import { SSEMcpServerService } from "./sse-mcp-server.service";

@Module({
  controllers: [SSEMcpServerController],
  providers: [SSEMcpServerService],
})
export class SSEMcpServerModule {}
