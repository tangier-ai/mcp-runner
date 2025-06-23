import { Controller, Delete, Get, Param, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { StreamableHttpMcpServerService } from "./streamable-http-mcp-server.service";

@Controller("/mcp-server/:deployment_id/mcp")
export class StreamableHttpMcpServerController {
  constructor(
    private readonly streamableHttpMcpServerService: StreamableHttpMcpServerService,
  ) {}

  @Post()
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
