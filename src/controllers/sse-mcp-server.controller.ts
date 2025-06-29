import { SSEMcpServerService } from "@/services/sse-mcp-server.service";
import { Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";

@Controller("/mcp-server/:deployment_id/sse")
@ApiTags("MCP Server - SSE")
export class SSEMcpServerController {
  constructor(private readonly sseService: SSEMcpServerService) {}

  @Get()
  @ApiOperation({
    operationId: "mcpServerSSE",
    summary: "Establish MCP SSE connection",
    description: "Server-Sent Events transport endpoint for establishing real-time, bidirectional communication with the MCP server. Enables streaming of server-to-client events and supports connection resumption via Last-Event-ID header.",
  })
  @ApiParam({
    name: "deployment_id",
    type: String,
    description: "The deployment ID",
  })
  @ApiResponse({
    status: 200,
    description: "SSE connection established",
    headers: {
      "Content-Type": {
        description: "text/event-stream",
        schema: { type: "string" },
      },
    },
  })
  async handleSSE(
    @Param("deployment_id") deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.sseService.handleSSE(deploymentId, req, res);
  }

  @Post("/messages")
  @ApiOperation({
    operationId: "mcpServerMessages",
    summary: "Send MCP JSON-RPC messages via SSE",
    description: "SSE transport endpoint for sending client-to-server JSON-RPC messages while maintaining the SSE connection for server responses and real-time event streaming.",
  })
  @ApiParam({
    name: "deployment_id",
    type: String,
    description: "The deployment ID",
  })
  @ApiResponse({
    status: 200,
    description: "Message sent successfully to MCP server",
  })
  async handleMessages(
    @Param("deployment_id") deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.sseService.handleMessages(deploymentId, req, res);
  }
}
