import { SseServerTransportProxy } from "@/mcp-transports/sse-server-transport-proxy";
import { StdioDockerClient } from "@/mcp-transports/stdio-docker-client";
import { BaseMcpServerService } from "@/services/base-mcp-server.service";
import { tryCatchPromise } from "@/utils/try-catch-promise";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Request, Response } from "express";
import { DeploymentService } from "./deployment.service";

export type TransportProxy = SseServerTransportProxy;

@Injectable()
export class SSEMcpServerService {
  private transports: { [sessionId: string]: TransportProxy } = {};
  private session_to_deployment_id: { [sessionId: string]: string } = {};

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
      client = new StdioDockerClient({ containerId: deployment.container_id });
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
    this.session_to_deployment_id[transport.sessionId] = deploymentId;

    transport.addCloseHandler(() => {
      if (transport.sessionId) {
        delete this.transports[transport.sessionId];
        delete this.session_to_deployment_id[transport.sessionId];
      }
    });

    transport.addOnMessageHandler(() =>
      this.deploymentService.updateLastInteraction(deploymentId),
    );

    // we need to do this to ensure that nginx doesn't break our SSE
    res.setHeader("X-Accel-Buffering", "no");
    res.on("close", () => {
      delete this.transports[transport.sessionId];
      delete this.session_to_deployment_id[transport.sessionId];
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
      console.error(`Deployment with ID ${deploymentId} not found`);

      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: `MCP server not running`,
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

  sessionActivityUpdateLocked = false;
  // every second, mark the deployments with active sessions as active
  @Cron("* * * * * *")
  async markSessionsAsActive(): Promise<void> {
    if (this.sessionActivityUpdateLocked) {
      return;
    }

    this.sessionActivityUpdateLocked = true;

    const deploymentIds = Array.from(
      new Set(Object.values(this.session_to_deployment_id)),
    );

    for (const deploymentId of deploymentIds) {
      // don't really care too much if this fails for now
      this.deploymentService.updateLastInteraction(deploymentId);
    }

    this.sessionActivityUpdateLocked = false;
  }
}
