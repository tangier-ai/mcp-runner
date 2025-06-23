import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";
import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";

const emptyServer = new McpServer({
  name: "empty_server",
  version: "1.0.0",
});

@Injectable()
export class SSEMcpServerService {
  private transports: { [sessionId: string]: SSEServerTransport } = {};

  async handleSSE(
    deploymentId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const transport = new SSEServerTransport(
      `/mcp-server/${deploymentId}/sse/messages`,
      res,
    );
    this.transports[transport.sessionId] = transport;

    // we need to do this to ensure that nginx doesn't break our SSE
    res.setHeader("X-Accel-Buffering", "no");
    res.on("close", () => {
      delete this.transports[transport.sessionId];
    });

    await emptyServer.connect(transport);
  }

  async handleMessages(
    deploymentId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
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
