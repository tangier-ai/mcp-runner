import { SseServerTransportProxy } from "@/mcp-proxy/sse-server-transport-proxy";
import { BaseMcpServerService } from "@/services/base-mcp-server.service";
import { tryCatchPromise } from "@/utils/try-catch-promise";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";
import { DeploymentService } from "./deployment.service";

export type TransportProxy = SseServerTransportProxy;

@Injectable()
export class SSEMcpServerService {
  private transports: { [sessionId: string]: TransportProxy } = {};

  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly baseMcpServerService: BaseMcpServerService,
  ) {}

  async handleSSE(
    deploymentId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const [containerReadyResponse, containerReadyError] = await tryCatchPromise(
      this.baseMcpServerService.ensureContainerReady(deploymentId),
    );

    if (containerReadyError) {
      await this.baseMcpServerService.sendErrorResponse(
        res,
        containerReadyError.message,
        -32001,
      );
      return;
    }

    const { ipAddress, deployment } = containerReadyResponse;

    let client: Transport;
    const authProvider = await this.baseMcpServerService.getOAuthProvider(req);

    if (deployment.transport.type === "stdio") {
      client = new StdioClientTransport({
        command: "docker",
        args: ["attach", deployment.container_id],
      });
    } else if (deployment.transport.type === "sse") {
      const url = new URL(deployment.transport.endpoint as string);
      url.hostname = ipAddress;

      client = new SSEClientTransport(url, { authProvider });
    } else if (deployment.transport.type === "streamable_http") {
      const url = new URL(deployment.transport.endpoint as string);
      url.hostname = ipAddress;

      client = new StreamableHTTPClientTransport(url, { authProvider });
    } else {
      await this.baseMcpServerService.sendErrorResponse(
        res,
        "unsupported transport type for underlying MCP server",
        -32001,
      );

      return;
    }

    const transport = new SseServerTransportProxy(
      client,
      `/mcp-server/${deploymentId}/sse/messages`,
      res,
    );

    this.transports[transport.sessionId] = transport;

    transport.addCloseHandler(() => {
      if (transport.sessionId) {
        delete this.transports[transport.sessionId];
      }
    });

    transport.addOnMessageHandler(() =>
      this.deploymentService.updateLastInteraction(deploymentId),
    );

    // we need to do this to ensure that nginx doesn't break our SSE
    res.setHeader("X-Accel-Buffering", "no");
    res.on("close", () => {
      delete this.transports[transport.sessionId];
    });

    await transport.start();
  }

  async handleMessages(
    deploymentId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const deployment = this.deploymentService.getDeployment(deploymentId);
    if (!deployment) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: `Deployment with ID ${deploymentId} not found`,
        },
        id: null,
      });
      return;
    }

    const sessionId = req.query.sessionId as string;
    const transport = this.transports[sessionId];

    const isValidBody = JSONRPCMessageSchema.safeParse(req.body);

    if (!isValidBody.success) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message:
            "Invalid Request: Body does not match JSON-RPC message schema",
        },
        id: null,
      });
      return;
    }

    if (transport) {
      res.setHeader("X-Accel-Buffering", "no");
      await transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(400).send("No transport found for sessionId");
    }
  }
}
