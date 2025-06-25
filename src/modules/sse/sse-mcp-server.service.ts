import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";
import { SSEServerTransportProxy } from "../../mcp-proxy/SSEServerTransportProxy";
import { DeploymentService } from "../app/deployment/deployment.service";

export type TransportProxy = SSEServerTransportProxy;

@Injectable()
export class SSEMcpServerService {
  private transports: { [sessionId: string]: TransportProxy } = {};

  constructor(private readonly deploymentService: DeploymentService) {}

  async getOAuthProvider(req: Request) {
    return {
      tokens: () => ({
        access_token: req.headers.authorization,
        token_type: "Bearer",
      }),
    } as unknown as OAuthClientProvider;
  }

  async handleSSE(
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

    let client: Transport;

    const authProvider = await this.getOAuthProvider(req);

    if (deployment.transport.type === "stdio") {
      client = new StdioClientTransport({
        command: "docker",
        args: ["attach", deployment.containerId],
      });
    } else if (deployment.transport.type === "sse") {
      const url = new URL(deployment.transport.endpoint as string);
      url.hostname = deployment.ipAddress;

      client = new SSEClientTransport(url, { authProvider });
    } else if (deployment.transport.type === "streamable_http") {
      const url = new URL(deployment.transport.endpoint as string);
      url.hostname = deployment.ipAddress;

      client = new StreamableHTTPClientTransport(url, { authProvider });
    } else {
      throw new Error(
        "unsupported transport type: " + deployment.transport.type,
      );
    }

    this.deploymentService.updateLastInteraction(deploymentId);

    const transport = new SSEServerTransportProxy(
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

    this.deploymentService.updateLastInteraction(deploymentId);

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
