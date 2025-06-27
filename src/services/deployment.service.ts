import { CreateDeploymentBody } from "@/controllers/deployment.controller.types";
import { db } from "@/db";
import {
  deploymentIdGenerator,
  DeploymentTable,
  TransportInfo,
} from "@/db/schema/deployment";
import { ContainerService } from "@/services/container.service";
import { LinuxUserService } from "@/services/linux-user.service";
import { NetworkService } from "@/services/network.service";
import { deploymentStore } from "@/store/deployment.store";
import { tryCatchPromise } from "@/utils/try-catch-promise";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Dockerode from "dockerode";
import { eq } from "drizzle-orm";

@Injectable()
export class DeploymentService implements OnModuleDestroy {
  public readonly docker: Dockerode;
  private isShuttingDown = false;

  constructor(
    private readonly networkService: NetworkService,
    private readonly containerService: ContainerService,
    private readonly linuxUserService: LinuxUserService,
  ) {
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
        const [, stopError] = await tryCatchPromise(
          this.containerService.stopContainer(deployment.containerId, graceful),
        );

        if (stopError && !canIgnoreError(stopError)) {
          console.warn(stopError);
        }

        const [, removalError] = await tryCatchPromise(
          this.containerService.removeContainer(deployment.containerId),
        );

        if (removalError && !canIgnoreError(removalError)) {
          console.warn(removalError);
        }

        const [, networkCleanupError] = await tryCatchPromise(
          this.networkService.cleanupNetwork(deploymentId),
        );

        if (networkCleanupError) {
          console.warn(
            `Failed to cleanup network for deployment ${deploymentId}:`,
            networkCleanupError,
          );
        }

        const [, userDeleteError] = await tryCatchPromise(
          this.linuxUserService.deleteUser(deployment.username),
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

  private async partialCleanup(
    deploymentId: string,
    options?: {
      username?: string;
      cleanupNetwork?: boolean;
    },
  ): Promise<void> {
    if (options?.cleanupNetwork) {
      await this.networkService.cleanupNetwork(deploymentId);
    }

    if (options?.username) {
      const [, userCleanupError] = await tryCatchPromise(
        this.linuxUserService.deleteUser(options.username),
      );

      if (userCleanupError) {
        console.warn(
          `Failed to cleanup user during error recovery:`,
          userCleanupError,
        );
      }
    }
  }

  async createDeployment(
    opts: CreateDeploymentBody,
  ): Promise<typeof DeploymentTable.$inferSelect> {
    const {
      image,
      args = [],
      env = {},
      maxMemory,
      maxCpus,
      metadata,
      transport,
      autoStart = true,
    } = opts;

    await this.containerService.pullImageIfNeeded(image);

    const deploymentId = deploymentIdGenerator();
    const userInfo = await this.linuxUserService.createUnprivilegedUser();

    const [network, networkCreationError] = await tryCatchPromise(
      this.networkService.createIsolatedNetwork(deploymentId),
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

    const networkName = this.networkService.getNetworkName(deploymentId);

    const [container, createError] = await tryCatchPromise(
      this.containerService.createSecureContainer({
        image,
        args,
        env,
        uid: userInfo.uid,
        gid: userInfo.gid,
        networkName,
        networkId: network.id,
        maxMemory,
        maxCpus,
      }),
    );

    if (createError || !container) {
      await this.partialCleanup(deploymentId, {
        username: userInfo.username,
        cleanupNetwork: true,
      });
      throw createError;
    }

    const [deployment] = await db
      .insert(DeploymentTable)
      .values({
        id: deploymentId,
        container_id: container.id,
        network_id: network.id,

        image,

        uid: userInfo.uid,
        gid: userInfo.gid,

        max_memory: maxMemory,
        max_cpus: maxCpus,
        metadata,
        transport: transport as TransportInfo,
        pause_after_seconds: null,
        delete_after_seconds: null,
      })
      .returning();

    if (autoStart) {
      const [, startError] = await tryCatchPromise(
        this.containerService.startContainer(container, deploymentId),
      );

      if (startError) {
        console.warn(startError);
      }
    }

    return deployment;
  }

  async getDeployment(deploymentId: string) {
    return await db.query.Deployment.findFirst({
      where: (table, { eq }) => eq(table.id, deploymentId),
    });
  }

  async getAllDeployments() {
    return await db.query.Deployment.findMany();
  }

  async updateLastInteraction(deploymentId: string) {
    const [deployment] = await db
      .update(DeploymentTable)
      .set({
        last_interaction_at: new Date(),
      })
      .returning();

    return deployment;
  }

  async deleteDeployment(deploymentId: string) {
    await this.cleanupDeployment(deploymentId, true);

    const [deletedDeployment] = await db
      .delete(DeploymentTable)
      .where(eq(DeploymentTable.id, deploymentId))
      .returning();

    return deletedDeployment;
  }
}
