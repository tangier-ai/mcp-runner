import { StreamableHttpMcpServerService } from "@/services/streamable-http-mcp-server.service";
import { Controller, Delete, Get, Param, Post, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";

@Controller("/mcp-server/:deployment_id/mcp")
@ApiTags("MCP Server - StreamableHTTP")
export class StreamableHttpMcpServerController {
  constructor(
    private readonly streamableHttpMcpServerService: StreamableHttpMcpServerService,
  ) {}

  @Post()
  @ApiOperation({
    operationId: "mcpServerPost",
    summary: "Send MCP JSON-RPC messages",
    description: "StreamableHTTP transport endpoint for sending JSON-RPC messages to the MCP server. Each client-to-server message is sent as an HTTP POST request with optional session management via Mcp-Session-Id header.",
  })
  @ApiParam({
    name: "deployment_id",
    type: String,
    description: "The deployment ID",
  })
  @ApiResponse({
    status: 200,
    description: "Request successfully forwarded to MCP server",
  })
  async handlePost(
    @Param("deployment_id") deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.streamableHttpMcpServerService.handlePostRequest(
      deploymentId,
      req,
      res,
    );
  }

  @Get()
  @ApiOperation({
    operationId: "mcpServerGet",
    summary: "Establish MCP session or receive server events",
    description: "StreamableHTTP transport endpoint for establishing MCP sessions and optionally upgrading to Server-Sent Events for real-time server-to-client communication.",
  })
  @ApiParam({
    name: "deployment_id",
    type: String,
    description: "The deployment ID",
  })
  @ApiResponse({
    status: 200,
    description: "Request successfully forwarded to MCP server",
  })
  async handleGet(
    @Param("deployment_id") deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // the streamable HTTP MCP server will manage the Get request
    await this.streamableHttpMcpServerService.handleTransportRequest(
      deploymentId,
      req,
      res,
    );
  }

  @Delete()
  @ApiOperation({
    operationId: "mcpServerDelete",
    summary: "Terminate MCP session",
    description: "StreamableHTTP transport endpoint for cleanly terminating MCP sessions and releasing server resources.",
  })
  @ApiParam({
    name: "deployment_id",
    type: String,
    description: "The deployment ID",
  })
  @ApiResponse({
    status: 200,
    description: "Request successfully forwarded to MCP server",
  })
  async handleDelete(
    @Param("deployment_id") deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // the streamable HTTP MCP server will manage the Delete request
    await this.streamableHttpMcpServerService.handleTransportRequest(
      deploymentId,
      req,
      res,
    );
  }
}
