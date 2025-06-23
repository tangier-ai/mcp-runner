import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Request, Response } from "express";

@Injectable()
export class StreamableHttpMcpServerService {
  private transports: { [sessionId: string]: StreamableHTTPServerTransport } =
    {};

  async handlePostRequest(
    deploymentId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    const mcpServer = new McpServer(
      {
        name: "empty_server",
        version: "1.0.0",
      },
      {},
    );

    if (sessionId && this.transports[sessionId]) {
      transport = this.transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const sessionIdGenerator = () => randomBytes(32).toString("hex");

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator,
        onsessioninitialized: (sessionId: string) => {
          this.transports[sessionId] = transport;
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete this.transports[transport.sessionId];
          mcpServer.close();
        }
      };

      await mcpServer.connect(transport);
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
