import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Request, Response } from "express";
import { StreamableHTTPServerTransportServerProxy } from "../../mcp-proxy/StreamableHTTPServerTransportServerProxy";
import { DeploymentService } from "../app/deployment/deployment.service";

export type TransportProxy = StreamableHTTPServerTransportServerProxy;

@Injectable()
export class StreamableHttpMcpServerService {
  private transports: {
    [sessionId: string]: TransportProxy;
  } = {};

  constructor(private readonly deploymentService: DeploymentService) {}

  async handlePostRequest(
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

    if (deployment.transport.type === "stdio") {
      client = new StdioClientTransport({
        command: "docker",
        args: ["attach", deployment.containerId],
      });
    } else {
      // TODO handle the remaining proxy types
      throw new Error(
        "unsupported transport type: " + deployment.transport.type,
      );
    }

    this.deploymentService.updateLastInteraction(deploymentId);

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: TransportProxy;

    if (sessionId && this.transports[sessionId]) {
      transport = this.transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const sessionIdGenerator = () => randomBytes(32).toString("hex");

      transport = new StreamableHTTPServerTransportServerProxy(client, {
        sessionIdGenerator,
        onsessioninitialized: (sessionId: string) => {
          this.transports[sessionId] = transport;
        },
      });

      transport.addCloseHandler(() => {
        if (transport.sessionId) {
          delete this.transports[transport.sessionId];
        }
      });

      await transport.start();
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    // we do this in case we're behind an NGINX proxy because otherwise buffering prevents streaming from working
    res.setHeader("X-Accel-Buffering", "no");
    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId && !this.transports[transport.sessionId]) {
      this.transports[transport.sessionId] = transport;
    }
  }

  async handleTransportRequest(
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

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // can't GET if sessionId is not provided
    if (!sessionId || !this.transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    // we do this in case we're behind an NGINX proxy because otherwise buffering prevents streaming from working
    res.setHeader("X-Accel-Buffering", "no");

    const transport = this.transports[sessionId];
    await transport.handleRequest(req, res);
  }
}
