import { Module } from "@nestjs/common";
import { StreamableHttpMcpServerController } from "./streamable-http-mcp-server.controller";
import { StreamableHttpMcpServerService } from "./streamable-http-mcp-server.service";

@Module({
  controllers: [StreamableHttpMcpServerController],
  providers: [StreamableHttpMcpServerService],
})
export class StreamableHttpMcpServerModule {}
