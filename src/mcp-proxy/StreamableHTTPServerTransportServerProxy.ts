import {
  StreamableHTTPServerTransport,
  StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/*
 * Terminology:
 *
 * * *External Client*:       This is the outside client that is trying to connect to the MCP Server via Streamable HTTP.
 * * *Underlying MCP Server*: This is the MCP server running in the docker container that we are trying to connect to.
 * * *MCP Client Transport*:  This is a connector we will use to connect to the underlying MCP Server.
 *                            This depends on the supported transport of the Underlying MCP Server.
 *
 */

// This is a middle-man that wraps the Underlying MCP Server
// This will let external clients use Streamable HTTP regardless of what transport the Underlying MCP Server uses.
export class StreamableHTTPServerTransportServerProxy extends StreamableHTTPServerTransport {
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
      client.send(message);
    };

    // when the Underlying MCP Server sends a message, forward it out to the External Client
    client.onmessage = (message) => this.send(message);

    // once the server is closed, it will also close the MCP Client Transport
    this.onclose = () => {
      client.close().catch((error) => {
        console.error("Error closing MCP Client Transport:", error);
      });
    };

    client.onerror = (error) => {
      // when the MCP Client Transport encounters an error, it forwards it to the Streamable HTTP Server Transport
      this.onerror?.(error);
    };
  }

  async start(): Promise<void> {
    // start the underlying MCP Client Transport when the Streamable HTTP Server Transport starts
    await this.client.start();
  }

  async close(): Promise<void> {
    this.onclose?.();
  }
}
