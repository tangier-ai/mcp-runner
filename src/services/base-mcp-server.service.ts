import { DeploymentTable } from "@/db/schema/deployment";
import {
  ContainerService,
  DockerContainerStatus,
} from "@/services/container.service";
import { DeploymentService } from "@/services/deployment.service";
import { NetworkService } from "@/services/network.service";
import { tryCatchPromise } from "@/utils/try-catch-promise";
import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";

export interface ContainerReadyResult {
  ipAddress: string;
  deployment: typeof DeploymentTable.$inferSelect;
}

@Injectable()
export class BaseMcpServerService {
  constructor(
    protected readonly deploymentService: DeploymentService,
    protected readonly containerService: ContainerService,
    private readonly networkService: NetworkService,
  ) {}

  async ensureContainerReady(
    deploymentId: string,
  ): Promise<ContainerReadyResult> {
    const deployment = await this.deploymentService.getDeployment(deploymentId);

    if (!deployment) {
      console.error(`Deployment with ID ${deploymentId} not found`);

      throw new Error(`MCP server not running`);
    }

    await this.inspectAndEnsureContainerRunning(
      deployment.container_id,
      deployment.id,
    );

    const ipAddress = await this.getContainerIpAddress(
      deploymentId,
      deployment.container_id,
    );

    if (!ipAddress) {
      console.error(
        `Could not retrieve network for deployment ${deploymentId}`,
      );

      throw new Error(`Could not connect to MCP server`);
    }

    return { ipAddress, deployment };
  }

  private async inspectAndEnsureContainerRunning(
    containerId: string,
    deploymentId: string,
  ) {
    const container = this.containerService.getContainer(containerId);

    let [containerInspectData, containerInspectError] = await tryCatchPromise(
      this.containerService.inspectContainer(containerId),
    );

    if (containerInspectError || !containerInspectData) {
      await this.deploymentService.deleteDeployment(deploymentId);
      console.error(`Container with ID ${containerId} not found`);

      throw new Error(`MCP server not running`);
    }

    let status = containerInspectData.State.Status as DockerContainerStatus;

    if (status === "created" || status === "paused" || status === "exited") {
      await this.containerService.startContainer(container, deploymentId);

      const [updatedInspect] = await tryCatchPromise(
        this.containerService.inspectContainer(containerId),
      );

      if (!updatedInspect) {
        console.error(
          `Container with ID ${containerId} not found after starting`,
        );

        throw new Error(`MCP server not running`);
      }

      containerInspectData = updatedInspect;
      status = containerInspectData.State.Status as DockerContainerStatus;
    }

    if (status !== "running") {
      console.error(
        `Container with ID ${containerId} is not running, current status: ${status}`,
      );

      throw new Error(`MCP server not running`);
    }

    return containerInspectData;
  }

  async getOAuthProvider(req: Request) {
    return {
      tokens: () => ({
        access_token: req.headers.authorization,
        token_type: "Bearer",
      }),
    } as unknown as OAuthClientProvider;
  }

  private async getContainerIpAddress(
    deploymentId: string,
    containerId: string,
  ): Promise<string> {
    const containerInspect =
      await this.containerService.inspectContainer(containerId);
    const networkName = this.networkService.getNetworkName(deploymentId);

    return (
      containerInspect.NetworkSettings.Networks[networkName]?.IPAddress || ""
    );
  }

  async sendErrorResponse(
    res: Response,
    error: string,
    code: number = -32001,
  ): Promise<void> {
    res.status(400).write(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code,
          message: error,
        },
        id: null,
      }),
    );

    res.end();
  }
}
