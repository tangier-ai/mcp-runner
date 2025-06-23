import { Controller, Delete, Get, Param, Req, Res, Sse } from "@nestjs/common";
import { Request, Response } from "express";
import { StreamableHttpMcpServerService } from "./streamable-http-mcp-server.service";

@Controller("/mcp-server/:deployment_id/mcp")
export class StreamableHttpMcpServerController {
  constructor(
    private readonly streamableHttpMcpServerService: StreamableHttpMcpServerService,
  ) {}

  @Get()
  @Sse()
  async handleGet(
    @Param("deployment_id") deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // the streamable HTTP MCP server will manage the Get request
    await this.streamableHttpMcpServerService.handleTransportRequest(req, res);
  }

  @Delete()
  async handleDelete(
    @Param("deployment_id") deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // the streamable HTTP MCP server will manage the Delete request
    await this.streamableHttpMcpServerService.handleTransportRequest(req, res);
  }
}
