import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import * as Sentry from "@sentry/node";
import { Request, Response } from "express";

/*
 * Terminology:
 *
 * * *External Client*:       This is the outside client that is trying to connect to the MCP Server via SSE.
 * * *Underlying MCP Server*: This is the MCP server running in the docker container that we are trying to connect to.
 * * *MCP Client Transport*:  This is a connector we will use to connect to the underlying MCP Server.
 *                            This depends on the supported transport of the Underlying MCP Server.
 *
 */

type CloseHandler = () => void;
type UnsubscribeFn = () => void;

// This is a middle-man that wraps the Underlying MCP Server
// This will let external clients use SSE regardless of what transport the Underlying MCP Server uses.
export class SseServerTransportProxy extends SSEServerTransport {
  onCloseHandlers: Array<CloseHandler> = [];
  onMessageHandlers: Array<(message: JSONRPCMessage) => void> = [];

  private originalIdMap: Record<string, string | number> = {};

  get proxyIdPrefix(): string {
    return this.sessionId + "::";
  }

  // set up listeners in the constructor
  constructor(
    // The MCP Client Transport that connects to the Underlying MCP Server
    private readonly client: Transport,

    // SSE endpoint path and response object
    endpoint: string,
    response: Response,
  ) {
    super(endpoint, response);

    // when the server receives a message, it forwards it to the actual Underlying MCP Server
    this.onmessage = async (message) => {
      // @ts-ignore id field exists, we know this
      const originalId = message.id;
      const proxyId = this.proxyIdPrefix + originalId;

      // Store the original ID mapping, this helps prevent number / string confusion
      this.originalIdMap[proxyId] = originalId;

      await client.send({
        ...message,
        id: proxyId,
      });

      this.onMessageHandlers.forEach((handler) => handler(message));
    };

    // when the Underlying MCP Server sends a message, forward it out to the External Client
    client.onmessage = async (message) => {
      if ("id" in message && message.id in this.originalIdMap) {
        // Extract the original ID from the prefixed ID
        const originalId: string | number = this.originalIdMap[message.id];

        this.send({
          ...message,

          // send back with original id
          id: originalId,
        }).catch(Sentry.captureException);
      }
    };

    // once the server is closed, it will also close the MCP Client Transport
    this.onclose = () => {
      client.close().catch((error) => {
        console.error("Error closing MCP Client Transport:", error);
      });

      this.onCloseHandlers.forEach((handler) => handler());
    };

    client.onerror = (error) => {
      // when the MCP Client Transport encounters an error, it forwards it to the SSE Server Transport
      this.onerror?.(error);
    };
  }

  addOnMessageHandler(
    handler: (message: JSONRPCMessage) => void,
  ): UnsubscribeFn {
    this.onMessageHandlers.push(handler);

    return () => {
      this.onMessageHandlers = this.onMessageHandlers.filter(
        (h) => h !== handler,
      );
    };
  }

  addCloseHandler(handler: CloseHandler): UnsubscribeFn {
    this.onCloseHandlers.push(handler);

    return () => {
      this.onCloseHandlers = this.onCloseHandlers.filter((h) => h !== handler);
    };
  }

  async start(): Promise<void> {
    // start the underlying MCP Client Transport when the SSE Server Transport starts
    await this.client.start();
    await super.start();
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  // Handle incoming POST messages from the external client
  async handlePostMessage(
    req: Request,
    res: Response,
    message: JSONRPCMessage,
  ): Promise<void> {
    try {
      this.onmessage?.(message);
    } catch (e) {
      Sentry.captureException(e);
    }

    res.writeHead(202).end("Accepted");
  }
}
