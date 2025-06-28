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
import { tryCatchPromise } from "@/utils/try-catch-promise";
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as Sentry from "@sentry/node";
import Dockerode from "dockerode";
import { eq } from "drizzle-orm";

@Injectable()
export class DeploymentService {
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

  private async cleanupAllDeployments(graceful: boolean) {
    const deployments = await this.getAllDeployments();

    await Promise.all(
      deployments.map((deployment) =>
        this.cleanupDeployment(deployment.id, graceful),
      ),
    );
  }

  private async cleanupDeployment(deploymentId: string, graceful: boolean) {
    const canIgnoreError = (error: Error) =>
      "statusCode" in error &&
      (error.statusCode === 304 || error.statusCode === 404);

    try {
      const deployment = await this.getDeployment(deploymentId);
      if (deployment) {
        const [, stopError] = await tryCatchPromise(
          this.containerService.stopContainer(
            deployment.container_id,
            graceful,
          ),
        );

        if (stopError && !canIgnoreError(stopError)) {
          console.warn(stopError);
        }

        const [, removalError] = await tryCatchPromise(
          this.containerService.removeContainer(deployment.container_id),
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
      pauseAfterSeconds,
      deleteAfterSeconds,
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

    const now = new Date();
    const pause_at = pauseAfterSeconds
      ? new Date(now.getTime() + pauseAfterSeconds * 1000)
      : null;

    const delete_at = deleteAfterSeconds
      ? new Date(now.getTime() + deleteAfterSeconds * 1000)
      : null;

    let [deployment] = await db
      .insert(DeploymentTable)
      .values({
        id: deploymentId,
        container_id: container.id,
        network_id: network.id,
        status: "stopped",

        image,

        uid: userInfo.uid,
        gid: userInfo.gid,
        username: userInfo.username,

        max_memory: maxMemory,
        max_cpus: maxCpus,
        metadata,
        transport: transport as TransportInfo,
        pause_after_seconds: pauseAfterSeconds,
        delete_after_seconds: deleteAfterSeconds,

        pause_at,
        delete_at,
      })
      .returning();

    if (autoStart) {
      const [, startError] = await tryCatchPromise(
        this.containerService.startContainer(container, deploymentId),
      );

      if (startError) {
        console.warn(startError);
      } else {
        const [updated] = await db
          .update(DeploymentTable)
          .set({ status: "running" })
          .where(eq(DeploymentTable.id, deploymentId))
          .returning();

        deployment = updated;
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
    const deployment = db.transaction((txn) => {
      const existing = txn.query.Deployment.findFirst({
        where: (table, { eq }) => eq(table.id, deploymentId),
      })
        .prepare()
        .get();

      if (!existing) {
        return;
      }

      const now = new Date();

      const pause_at = existing.pause_after_seconds
        ? new Date(now.getTime() + existing.pause_after_seconds * 1000)
        : null;

      const delete_at = existing.delete_after_seconds
        ? new Date(now.getTime() + existing.delete_after_seconds * 1000)
        : null;

      const [updated] = txn
        .update(DeploymentTable)
        .set({
          last_interaction_at: now,
          pause_at,
          delete_at,
        })
        .where(eq(DeploymentTable.id, deploymentId))
        .returning()
        .all();

      return updated;
    });

    return deployment;
  }

  async deleteDeployment(deploymentId: string, graceful = true) {
    await this.cleanupDeployment(deploymentId, graceful);

    const [deletedDeployment] = await db
      .delete(DeploymentTable)
      .where(eq(DeploymentTable.id, deploymentId))
      .returning();

    return deletedDeployment;
  }

  deletionFails = new Set<string>();
  deleteScheduleLocked = false;
  @Cron("* * * * * *")
  async deleteSchedule() {
    if (this.deleteScheduleLocked) {
      return;
    }

    this.deleteScheduleLocked = true;

    const now = new Date();

    const rows_needing_deletion = await db.query.Deployment.findMany({
      where: (table, { lte }) => lte(table.delete_at, now),
    }).catch(() => []);

    for (let i = 0; i < rows_needing_deletion.length; i++) {
      const d = rows_needing_deletion[i];

      // do not try again if we already failed to delete it
      if (this.deletionFails.has(d.id)) {
        continue;
      }

      await this.deleteDeployment(d.id).catch((er) => {
        this.deletionFails.add(d.id);
        console.warn(er);
        Sentry.captureException(er, { extra: { deployment: d } });
      });
    }

    this.deleteScheduleLocked = false;
  }

  pauseFails = new Set<string>();
  pauseScheduleLocked = false;
  @Cron("* * * * * *")
  async pauseSchedule() {
    if (this.pauseScheduleLocked) {
      return;
    }

    this.pauseScheduleLocked = true;
    const now = new Date();

    const needs_pausing = await db.query.Deployment.findMany({
      where: (table, { lte, eq, and }) =>
        and(eq(table.status, "running"), lte(table.pause_at, now)),
    });

    for (let i = 0; i < needs_pausing.length; i++) {
      const d = needs_pausing[i];

      if (this.pauseFails.has(d.id)) {
        continue;
      }

      await this.containerService.stopContainer(d.container_id).catch((er) => {
        Sentry.captureException(er);
        console.warn(er);
        this.pauseFails.add(d.id);
      });

      await db
        .update(DeploymentTable)
        .set({ status: "stopped" })
        .where(eq(DeploymentTable.id, d.id));
    }

    this.pauseScheduleLocked = false;
  }
}
