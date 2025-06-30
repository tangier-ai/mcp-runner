import { tryCatchPromise } from "@/utils/try-catch-promise";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types";
import {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import Dockerode from "dockerode";

export interface StdioDockerClientOptions {
  containerId: string;
  docker?: Dockerode;
}

export class StdioDockerClient implements Transport {
  private stream?: NodeJS.ReadWriteStream;
  private started = false;
  private docker: Dockerode;

  private container: Dockerode.Container;

  onclose?: (() => void) | undefined;
  onerror?: ((error: Error) => void) | undefined;
  onmessage?:
    | ((message: JSONRPCMessage, extra?: { authInfo?: AuthInfo }) => void)
    | undefined;

  constructor(options: StdioDockerClientOptions) {
    this.docker = options.docker || new Dockerode();
    this.container = this.docker.getContainer(options.containerId);
  }

  private processDockerStream(chunk: Buffer): void {
    // Handle Docker's multiplexed stream format
    // Each frame has an 8-byte header: [stream_type][padding][size][payload]
    let offset = 0;
    while (offset < chunk.length) {
      if (chunk.length - offset < 8) {
        // Not enough data for a complete header
        break;
      }

      // Skip the 8-byte header and get the payload
      const payloadSize = chunk.readUInt32BE(offset + 4);
      const payloadStart = offset + 8;
      const payloadEnd = payloadStart + payloadSize;

      if (payloadEnd > chunk.length) {
        // Incomplete payload
        break;
      }

      const payload = chunk.subarray(payloadStart, payloadEnd);
      const data = payload.toString();
      const lines = data.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const message = JSON.parse(line) as JSONRPCMessage;
          this.onmessage?.(message);
        } catch (parseError) {
          this.onerror?.(
            parseError instanceof Error ? parseError : new Error(parseError),
          );
        }
      }

      offset = payloadEnd;
    }
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const [stream, error] = await tryCatchPromise(
      this.container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
      }),
    );

    if (error) {
      throw error;
    }

    this.stream = stream;

    this.stream.on("data", (chunk: Buffer) => {
      try {
        this.processDockerStream(chunk);
      } catch (error) {
        this.onerror?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    this.stream.on("error", (error: Error) => {
      this.onerror?.(error);
    });

    this.stream.on("end", () => {
      this.onclose?.();
    });

    this.started = true;
  }

  async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    if (!this.stream || !this.started) {
      throw new Error("Transport not started");
    }

    const messageStr = JSON.stringify(message) + "\n";

    return new Promise((resolve, reject) => {
      this.stream!.write(messageStr, "utf8", (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    if (this.stream) {
      this.stream.end();
      this.stream = undefined;
    }
    this.started = false;
  }
}
