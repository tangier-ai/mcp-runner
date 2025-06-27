import { StdioDockerClient } from "@/mcp-transports/stdio-docker-client";
import { StreamableHttpServerTransportServerProxy } from "@/mcp-transports/streamable-http-server-transport-server-proxy";
import { BaseMcpServerService } from "@/services/base-mcp-server.service";
import { tryCatchPromise } from "@/utils/try-catch-promise";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Request, Response } from "express";
import { DeploymentService } from "./deployment.service";

export type TransportProxy = StreamableHttpServerTransportServerProxy;

// TODO WE NEED TO FORWARD AUTH REDIRECTS

@Injectable()
export class StreamableHttpMcpServerService {
  private transports: {
    [sessionId: string]: TransportProxy;
  } = {};

  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly baseMcpServerService: BaseMcpServerService,
  ) {}

  async handlePostRequest(
    deploymentId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    let client: Transport;

    const [deploymentInfo, deploymentError] = await tryCatchPromise(
      this.baseMcpServerService.ensureContainerReady(deploymentId),
    );

    if (deploymentError) {
      await this.baseMcpServerService.sendErrorResponse(
        res,
        deploymentError.message,
        -32001,
      );

      return;
    }

    const { deployment, ipAddress } = deploymentInfo;

    const authProvider = await this.baseMcpServerService.getOAuthProvider(req);

    if (deployment.transport.type === "stdio") {
      client = new StdioDockerClient({ containerId: deployment.container_id });
    } else if (deployment.transport.type === "sse") {
      const url = new URL(deployment.transport.endpoint as string);
      url.hostname = ipAddress;

      client = new SSEClientTransport(url, {
        authProvider,
      });
    } else if (deployment.transport.type === "streamable_http") {
      const url = new URL(deployment.transport.endpoint as string);
      url.hostname = ipAddress;

      client = new StreamableHTTPClientTransport(url, {
        authProvider,
      });
    } else {
      // TODO handle the remaining proxy types
      throw new Error(
        "unsupported transport type: " + deployment.transport.type,
      );
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: TransportProxy;

    if (sessionId && this.transports[sessionId]) {
      transport = this.transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const sessionIdGenerator = () => randomBytes(32).toString("hex");

      transport = new StreamableHttpServerTransportServerProxy(client, {
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

      transport.addOnMessageHandler(() =>
        this.deploymentService.updateLastInteraction(deploymentId),
      );

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
    // Ensure the deployment is ready
    const [, deploymentError] = await tryCatchPromise(
      this.baseMcpServerService.ensureContainerReady(deploymentId),
    );

    if (deploymentError) {
      await this.baseMcpServerService.sendErrorResponse(
        res,
        deploymentError.message,
        -32001,
      );
      return;
    }

    await this.deploymentService.updateLastInteraction(deploymentId);

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
