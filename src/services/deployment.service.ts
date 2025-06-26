import {
  CreateDeploymentBody,
  DeploymentInfo,
} from "@/controllers/deployment.controller.types";
import { deploymentStore } from "@/store/deployment.store";
import { tryCatchPromise } from "@/utils/tryCatchPromise";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { exec } from "child_process";
import { randomBytes } from "crypto";
import Dockerode from "dockerode";
import { PassThrough } from "stream";
import { promisify } from "util";

const execAsync = promisify(exec);

@Injectable()
export class DeploymentService implements OnModuleDestroy {
  public readonly docker: Dockerode;
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
    const deploymentIds = Array.from(deploymentStore.keys());

    await Promise.all(
      deploymentIds.map((deploymentId) =>
        this.cleanupDeployment(deploymentId, graceful),
      ),
    );
  }

  private async cleanupDeployment(deploymentId: string, graceful: boolean) {
    const canIgnoreError = (error: Error) =>
      "statusCode" in error &&
      (error.statusCode === 304 || error.statusCode === 404);

    try {
      const deployment = deploymentStore.get(deploymentId);
      if (deployment) {
        const container = this.docker.getContainer(deployment.containerId);

        if (graceful) {
          const [, stopError] = await tryCatchPromise(
            container.stop({ t: 10 }),
          );

          if (stopError && !canIgnoreError(stopError)) {
            throw stopError;
          }
        } else {
          const [, killError] = await tryCatchPromise(container.kill());
          if (killError && !canIgnoreError(killError)) {
            throw killError;
          }
        }

        const [, removalError] = await tryCatchPromise(container.remove());

        if (!!removalError && !canIgnoreError(removalError)) {
          console.warn(removalError);
        }

        const [, networkCleanupError] = await tryCatchPromise(
          this.cleanupNetwork(deploymentId),
        );

        if (networkCleanupError) {
          console.warn(
            `Failed to cleanup network for deployment ${deploymentId}:`,
            networkCleanupError,
          );
        }

        const [, userDeleteError] = await tryCatchPromise(
          execAsync(`sudo userdel ${deployment.username}`),
        );

        if (userDeleteError) {
          console.warn(
            `Failed to delete user ${deployment.username}:`,
            userDeleteError,
          );
        }

        deploymentStore.delete(deploymentId);
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
    const username = randomBytes(16).toString("hex");

    const [, userCreateError] = await tryCatchPromise(
      execAsync(`sudo useradd -r -s /bin/false -M ${username}`),
    );

    if (userCreateError) {
      throw new Error(
        `Failed to create user ${username}: ${userCreateError.message}`,
      );
    }

    const [idResult, idError] = await tryCatchPromise(
      execAsync(`id ${username}`),
    );
    if (idError) {
      throw new Error(
        `Failed to get user info for ${username}: ${idError.message}`,
      );
    }

    const match = idResult?.stdout.match(/uid=(\d+).*gid=(\d+)/);
    if (!match) {
      throw new Error(`Failed to parse user info for ${username}`);
    }

    const uid = parseInt(match[1]);
    const gid = parseInt(match[2]);

    return { username, uid, gid };
  }

  async createIsolatedNetwork(deploymentId: string) {
    const Name = `container-${deploymentId}-network`;

    const network = await this.docker.createNetwork({
      Name,
      Driver: "bridge",
      Internal: false,
      Attachable: false,
      Ingress: false,
      IPAM: {
        Driver: "default",
        Options: {
          "com.docker.network.driver.mtu": "1500",
        },
      },
      EnableIPv4: true,
      Options: {
        "com.docker.network.bridge.enable_icc": "false",
        "com.docker.network.bridge.enable_ip_masquerade": "true",
        "com.docker.network.bridge.name": `br-${deploymentId.substring(0, 12)}`,
      },
      Labels: {
        "mcp-runner.deployment-id": deploymentId,
      },
    });

    return network;
  }

  private async cleanupNetwork(deploymentId: string): Promise<void> {
    const networkName = `container-${deploymentId}-network`;

    const [networks, listError] = await tryCatchPromise(
      this.docker.listNetworks({
        filters: {
          name: [networkName],
        },
      }),
    );

    if (listError) {
      console.error(listError);
      throw new Error(
        "Failed to list networks for cleanup: " + listError.message,
      );
    }

    for (const networkInfo of networks) {
      const network = this.docker.getNetwork(networkInfo.Id);
      const [, removeError] = await tryCatchPromise(network.remove());

      if (removeError) {
        console.warn(
          `Failed to remove network ${networkInfo.Id}:`,
          removeError,
        );
      }
    }
  }

  private async partialCleanup(
    deploymentId: string,
    options?: {
      username?: string;
      cleanupNetwork?: boolean;
    },
  ): Promise<void> {
    if (options?.cleanupNetwork) {
      await this.cleanupNetwork(deploymentId);
    }

    if (options?.username) {
      const [, userCleanupError] = await tryCatchPromise(
        execAsync(`sudo userdel -r ${options.username}`),
      );

      if (userCleanupError) {
        console.warn(
          `Failed to cleanup user during error recovery:`,
          userCleanupError,
        );
      }
    }
  }

  private async pullImage(image: string): Promise<void> {
    const [stream, pullError] = await tryCatchPromise(this.docker.pull(image));

    if (pullError) {
      throw new Error(`Failed to pull image ${image}: ${pullError.message}`);
    }

    const [, followError] = await tryCatchPromise(
      new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err: any) => {
          if (err) {
            reject(new Error(`Failed to pull image ${image}: ${err.message}`));
          } else {
            console.log(`Successfully pulled image ${image}`);
            resolve();
          }
        });
      }),
    );

    if (followError) {
      throw followError;
    }
  }

  private async pullImageIfNeeded(imageId: string): Promise<void> {
    const [, inspectError] = await tryCatchPromise(
      this.docker.getImage(imageId).inspect(),
    );

    if (inspectError) {
      console.log(`Image ${imageId} not found locally, pulling...`);
      await this.pullImage(imageId);
    }
  }

  async createDeployment(
    deploymentData: CreateDeploymentBody,
  ): Promise<string> {
    const {
      image,
      args = [],
      envVars = {},
      maxMemory,
      maxCpus,
      maxInactivityDeletion = null,
      metadata,
      transport,
    } = deploymentData;

    await this.pullImageIfNeeded(image);

    const deploymentId = randomBytes(64).toString("base64url");
    const userInfo = await this.createUnprivilegedUser();
    const [network, networkCreationError] = await tryCatchPromise(
      this.createIsolatedNetwork(deploymentId),
    );

    if (networkCreationError) {
      await this.partialCleanup(deploymentId, {
        username: userInfo.username,
        cleanupNetwork: false,
      });

      throw new Error(
        `Failed to create isolated network for deployment ${deploymentId}: ${networkCreationError.message}`,
      );
    }

    const networkName = `container-${deploymentId}-network`;

    const envArray = Object.entries({
      ...envVars,
    }).map(([key, value]) => `${key}=${value}`);

    const now = new Date();

    const containerOptions: Dockerode.ContainerCreateOptions = {
      Image: image,
      Cmd: args.length > 0 ? args : undefined,
      name: deploymentId,
      Env: envArray.length > 0 ? envArray : undefined,
      OpenStdin: true,
      User: `${userInfo.uid}:${userInfo.gid}`,
      Tty: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        // super important! we need to use gVisor as our runtime
        Runtime: "runsc",

        NetworkMode: networkName,

        SecurityOpt: [
          // do not allow privilege escalation
          "no-new-privileges:true",
          "apparmor:docker-default",
          "seccomp:unconfined",
        ],

        // drop these for security
        CapDrop: ["SYS_ADMIN", "NET_ADMIN", "SYS_PTRACE", "SYS_MODULE"],

        ReadonlyRootfs: false,
        Privileged: false,

        // google / cloudflare for dns
        Dns: ["8.8.8.8", "1.1.1.1"],

        // nginx specific mounts, doesn't work otherwise
        Tmpfs: {
          "/var/cache/nginx": "rw,noexec,nosuid,size=100m",
          "/var/run": "rw,noexec,nosuid,size=100m",
        },

        // storage limit
        StorageOpt: {
          size: "2GB",
        },
      },

      NetworkingConfig: {
        EndpointsConfig: {
          [networkName]: {
            NetworkID: network.id,
          },
        },
      },

      Labels: {
        "mcp-runner.username": userInfo.username,
        "mcp-runner.deployment-id": deploymentId,
      },
    };

    if (maxMemory) {
      containerOptions.HostConfig!.Memory = maxMemory * 1024 * 1024;
    }

    if (maxCpus) {
      containerOptions.HostConfig!.NanoCpus = maxCpus * 1000000000;
    }

    if (maxInactivityDeletion !== null) {
      containerOptions.Labels!["mcp-runner.max-inactivity"] =
        maxInactivityDeletion.toString();
    }

    const [container, createError] = await tryCatchPromise(
      this.docker.createContainer(containerOptions),
    );

    if (createError) {
      await this.partialCleanup(deploymentId, {
        username: userInfo.username,
        cleanupNetwork: true,
      });
      throw createError;
    }

    const stderr = new PassThrough();

    const deploymentInfo: DeploymentInfo = {
      id: deploymentId,
      containerId: container.id,
      image,
      username: userInfo.username,
      uid: userInfo.uid,
      gid: userInfo.gid,
      maxMemory,
      maxCpus,
      maxInactivityDeletion,
      createdAt: now,
      lastInteraction: now,
      metadata,
      ipAddress: "",
      state: "started",
      transport,
    };

    stderr.on("data", async (chunk) => {
      const data = chunk.toString();

      deploymentInfo.error = deploymentInfo.error
        ? deploymentInfo.error + data
        : data;
    });

    const [, startError] = await tryCatchPromise(container.start());

    const containerInspectData = await container.inspect();

    deploymentInfo.ipAddress =
      containerInspectData.NetworkSettings.Networks[networkName].IPAddress;

    if (startError) {
      await this.partialCleanup(deploymentId, {
        username: userInfo.username,
        cleanupNetwork: true,
      });
      throw startError;
    }

    // stderr stream
    const stream = await container.attach({
      stream: true,
      stdout: false,
      stderr: true,
      stdin: false,
    });

    stream.pipe(stderr, { end: false });

    deploymentInfo.containerId = container.id;

    deploymentStore.set(deploymentId, deploymentInfo);

    return deploymentId;
  }

  getDeployment(deploymentId: string): DeploymentInfo | undefined {
    return deploymentStore.get(deploymentId);
  }

  getAllDeployments(): DeploymentInfo[] {
    return Array.from(deploymentStore.values());
  }

  updateLastInteraction(deploymentId: string): void {
    const deployment = deploymentStore.get(deploymentId);
    if (deployment) {
      deployment.lastInteraction = new Date();
    }
  }

  async deleteDeployment(deploymentId: string): Promise<void> {
    await this.cleanupDeployment(deploymentId, true);
  }
}
