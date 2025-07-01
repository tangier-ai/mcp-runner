import {
  StreamableHTTPServerTransport,
  StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import * as Sentry from "@sentry/node";

/*
 * Terminology:
 *
 * * *External Client*:       This is the outside client that is trying to connect to the MCP Server via Streamable HTTP.
 * * *Underlying MCP Server*: This is the MCP server running in the docker container that we are trying to connect to.
 * * *MCP Client Transport*:  This is a connector we will use to connect to the underlying MCP Server.
 *                            This depends on the supported transport of the Underlying MCP Server.
 *
 */

type CloseHandler = () => void;
type UnsubscribeFn = () => void;

// This is a middle-man that wraps the Underlying MCP Server
// This will let external clients use Streamable HTTP regardless of what transport the Underlying MCP Server uses.
export class StreamableHttpServerTransportServerProxy extends StreamableHTTPServerTransport {
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

    // Options for the Streamable HTTP Server Transport
    options: StreamableHTTPServerTransportOptions,
  ) {
    super(options);

    // when the server receives a message, it forwards it to the actual Underlying MCP Server
    this.onmessage = (message) => {
      // @ts-ignore
      const originalId = message.id;

      const proxyId = this.proxyIdPrefix + originalId;
      this.originalIdMap[proxyId] = originalId;

      client.send({
        ...message,
        id: proxyId,
      });

      this.onMessageHandlers.forEach((handler) => handler(message));
    };

    // when the Underlying MCP Server sends a message, forward it out to the External Client
    client.onmessage = async (message) => {
      if ("id" in message && message.id in this.originalIdMap) {
        const originalId = this.originalIdMap[message.id];

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
      // when the MCP Client Transport encounters an error, it forwards it to the Streamable HTTP Server Transport
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
    // start the underlying MCP Client Transport when the Streamable HTTP Server Transport starts
    await this.client.start();
    await super.start();
  }

  async close(): Promise<void> {
    this.onclose?.();
  }
}
