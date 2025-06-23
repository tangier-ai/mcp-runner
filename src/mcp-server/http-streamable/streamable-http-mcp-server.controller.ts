import { Controller, Delete, Get, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { StreamableHttpMcpServerService } from "./streamable-http-mcp-server.service";

@Controller("/mcp-server/:deployment_id/mcp")
export class StreamableHttpMcpServerController {
  constructor(
    private readonly streamableHttpMcpServerService: StreamableHttpMcpServerService,
  ) {}

  @Post()
  async handlePost(@Req() req: Request, @Res() res: Response): Promise<void> {
    // likely to initiate a new request
    await this.streamableHttpMcpServerService.handlePostRequest(req, res);
  }

  @Get()
  async handleGet(@Req() req: Request, @Res() res: Response): Promise<void> {
    // the streamable HTTP MCP server will manage the Get request
    await this.streamableHttpMcpServerService.handleTransportRequest(req, res);
  }

  @Delete()
  async handleDelete(@Req() req: Request, @Res() res: Response): Promise<void> {
    // the streamable HTTP MCP server will manage the Delete request
    await this.streamableHttpMcpServerService.handleTransportRequest(req, res);
  }
}
