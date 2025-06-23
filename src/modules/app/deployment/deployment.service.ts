import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { exec } from "child_process";
import { randomBytes } from "crypto";
import Dockerode from "dockerode";
import { promisify } from "util";
import { CreateDeploymentBody, DeploymentInfo } from "./deployment.types";

const execAsync = promisify(exec);

@Injectable()
export class DeploymentService implements OnModuleDestroy {
  private docker: Dockerode;
  private deployments = new Map<string, DeploymentInfo>();
  private userCounter = 0;
  private isShuttingDown = false;

  constructor() {
    this.docker = new Dockerode();
    this.setupProcessHandlers();
  }

  private setupProcessHandlers() {
    const gracefulShutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(`Received ${signal}, cleaning up deployments...`);

      const isGraceful = signal === "SIGTERM" || signal === "SIGINT";
      await this.cleanupAllDeployments(isGraceful);

      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));
  }

  async onModuleDestroy() {
    await this.cleanupAllDeployments(true);
  }

  private async cleanupAllDeployments(graceful: boolean) {
    const deploymentIds = Array.from(this.deployments.keys());

    await Promise.all(
      deploymentIds.map((deploymentId) =>
        this.cleanupDeployment(deploymentId, graceful),
      ),
    );
  }

  private async cleanupDeployment(deploymentId: string, graceful: boolean) {
    try {
      const deployment = this.deployments.get(deploymentId);
      if (deployment) {
        const container = this.docker.getContainer(deployment.containerId);

        if (graceful) {
          await container.stop({ t: 10 });
        } else {
          await container.kill();
        }

        await container.remove();

        await this.cleanupNetwork(deploymentId);

        try {
          await execAsync(`sudo userdel -r ${deployment.username}`);
        } catch (error) {
          console.warn(`Failed to delete user ${deployment.username}:`, error);
        }

        this.deployments.delete(deploymentId);
      }
    } catch (error) {
      console.error(`Error cleaning up deployment ${deploymentId}:`, error);
    }
  }

  private async createUnprivilegedUser(): Promise<{
    username: string;
    uid: number;
    gid: number;
  }> {
    const username = `deploy-${Date.now()}-${this.userCounter++}`;

    try {
      await execAsync(`sudo useradd -r -s /bin/false -M ${username}`);

      const { stdout } = await execAsync(`id ${username}`);
      const match = stdout.match(/uid=(\d+).*gid=(\d+)/);

      if (!match) {
        throw new Error(`Failed to parse user info for ${username}`);
      }

      const uid = parseInt(match[1]);
      const gid = parseInt(match[2]);

      return { username, uid, gid };
    } catch (error) {
      throw new Error(`Failed to create user ${username}: ${error.message}`);
    }
  }

  private async createIsolatedNetwork(deploymentId: string): Promise<string> {
    const networkName = `container-${deploymentId}-network`;

    try {
      const network = await this.docker.createNetwork({
        Name: networkName,
        Driver: "bridge",
        Internal: false,
        Attachable: false,
        Ingress: false,
        EnableIPv6: false,
        IPAM: {
          Driver: "default",
          Config: [
            {
              Subnet: "172.31.0.0/16",
            },
          ],
        },
        Options: {
          "com.docker.network.bridge.enable_icc": "false",
          "com.docker.network.bridge.enable_ip_masquerade": "true",
        },
        Labels: {
          "secure-mcp-runner.type": "deployment-network",
          "secure-mcp-runner.deployment-id": deploymentId,
          "secure-mcp-runner.created": new Date().toISOString(),
        },
      });

      return network.id;
    } catch (error) {
      throw new Error(
        `Failed to create isolated network for ${deploymentId}: ${error.message}`,
      );
    }
  }

  private async cleanupNetwork(deploymentId: string): Promise<void> {
    const networkName = `container-${deploymentId}-network`;

    try {
      const networks = await this.docker.listNetworks({
        filters: {
          name: [networkName],
        },
      });

      for (const networkInfo of networks) {
        const network = this.docker.getNetwork(networkInfo.Id);
        await network.remove();
      }
    } catch (error) {
      console.warn(`Failed to cleanup network for ${deploymentId}:`, error);
    }
  }

  private async pullImage(imageId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.docker.pull(imageId, (err: any, stream: any) => {
        if (err) {
          reject(new Error(`Failed to pull image ${imageId}: ${err.message}`));
          return;
        }

        this.docker.modem.followProgress(stream, (err: any, res: any) => {
          if (err) {
            reject(
              new Error(`Failed to pull image ${imageId}: ${err.message}`),
            );
          } else {
            console.log(`Successfully pulled image ${imageId}`);
            resolve();
          }
        });
      });
    });
  }

  private async pullImageIfNeeded(imageId: string): Promise<void> {
    try {
      await this.docker.getImage(imageId).inspect();
    } catch (error) {
      console.log(`Image ${imageId} not found locally, pulling...`);
      await this.pullImage(imageId);
    }
  }

  async createDeployment(
    deploymentData: CreateDeploymentBody,
  ): Promise<string> {
    const {
      imageId,
      args = [],
      envVars = {},
      maxMemory,
      maxCpus,
      maxInactivityDeletion = null,
      metadata,
    } = deploymentData;

    await this.pullImageIfNeeded(imageId);

    const deploymentId = randomBytes(64).toString("base64url");
    const userInfo = await this.createUnprivilegedUser();
    const networkId = await this.createIsolatedNetwork(deploymentId);
    const networkName = `container-${deploymentId}-network`;

    const envArray = Object.entries(envVars).map(
      ([key, value]) => `${key}=${value}`,
    );
    const now = new Date();

    const containerOptions: Dockerode.ContainerCreateOptions = {
      Image: imageId,
      Cmd: args.length > 0 ? args : undefined,
      Env: envArray.length > 0 ? envArray : undefined,
      User: `${userInfo.uid}:${userInfo.gid}`,
      HostConfig: {
        Runtime: "/usr/bin/runsc",
        NetworkMode: networkName,
        SecurityOpt: [
          "no-new-privileges:true",
          "apparmor:unconfined",
          "seccomp:unconfined",
        ],
        CapDrop: ["ALL"],
        ReadonlyRootfs: false,
        Privileged: false,
      },
      NetworkingConfig: {
        EndpointsConfig: {
          [networkName]: {
            NetworkID: networkId,
          },
        },
      },
      Labels: {
        "secure-mcp-runner.type": "deployment",
        "secure-mcp-runner.created": now.toISOString(),
        "secure-mcp-runner.username": userInfo.username,
        "secure-mcp-runner.deployment-id": deploymentId,
        "secure-mcp-runner.network-id": networkId,
      },
    };

    if (maxMemory) {
      containerOptions.HostConfig!.Memory = maxMemory * 1024 * 1024;
    }

    if (maxCpus) {
      containerOptions.HostConfig!.NanoCpus = maxCpus * 1000000000;
    }

    if (maxInactivityDeletion !== null) {
      containerOptions.Labels!["secure-mcp-runner.max-inactivity"] =
        maxInactivityDeletion.toString();
    }

    try {
      const container = await this.docker.createContainer(containerOptions);

      const deploymentInfo: DeploymentInfo = {
        id: deploymentId,
        containerId: container.id,
        imageId,
        username: userInfo.username,
        uid: userInfo.uid,
        gid: userInfo.gid,
        args,
        envVars,
        maxMemory,
        maxCpus,
        maxInactivityDeletion,
        createdAt: now,
        lastInteraction: now,
        metadata,
      };

      await container.start();

      this.deployments.set(deploymentId, deploymentInfo);

      return deploymentId;
    } catch (error) {
      await this.cleanupNetwork(deploymentId);
      try {
        await execAsync(`sudo userdel -r ${userInfo.username}`);
      } catch (cleanupError) {
        console.warn(
          `Failed to cleanup user during error recovery:`,
          cleanupError,
        );
      }
      throw error;
    }
  }

  getDeployment(deploymentId: string): DeploymentInfo | undefined {
    return this.deployments.get(deploymentId);
  }

  getAllDeployments(): DeploymentInfo[] {
    return Array.from(this.deployments.values());
  }

  updateLastInteraction(deploymentId: string): void {
    const deployment = this.deployments.get(deploymentId);
    if (deployment) {
      deployment.lastInteraction = new Date();
    }
  }
}
