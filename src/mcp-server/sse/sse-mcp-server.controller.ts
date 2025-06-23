import { Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { SSEMcpServerService } from "./sse-mcp-server.service";

@Controller("/mcp-server/:deployment_id/sse")
export class SSEMcpServerController {
  constructor(private readonly sseService: SSEMcpServerService) {}

  @Get()
  async handleSSE(
    @Param("deployment_id") deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.sseService.handleSSE(deploymentId, req, res);
  }

  @Post("/messages")
  async handleMessages(
    @Param("deployment_id") deploymentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.sseService.handleMessages(deploymentId, req, res);
  }
}
