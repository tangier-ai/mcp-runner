import { db } from "@/db";
import { DeploymentTable } from "@/db/schema/deployment";
import { tryCatchPromise } from "@/utils/try-catch-promise";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { PassThrough } from "stream";

import Dockerode from "dockerode";

export interface ContainerCreateOptions {
  // the image to use for the container
  image: string;

  // runtime args for the container
  args: string[];

  // environment variables for the container
  env: Record<string, string>;

  // the user and group to run the container as
  uid: number;
  gid: number;

  networkName: string;
  networkId: string;

  maxMemory?: number;
  maxCpus?: number;
}

export type DockerContainerStatus =
  | "created"
  | "restarting"
  | "running"
  | "removing"
  | "paused"
  | "exited"
  | "dead";

@Injectable()
export class ContainerService {
  private readonly docker: Dockerode;

  constructor() {
    this.docker = new Dockerode();
  }

  async pullImage(image: string): Promise<void> {
    const stream = await this.docker.pull(image);

    await tryCatchPromise(
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
  }

  async pullImageIfNeeded(imageId: string): Promise<void> {
    const [, inspectError] = await tryCatchPromise(
      this.docker.getImage(imageId).inspect(),
    );

    if (inspectError) {
      console.log(`Image ${imageId} not found locally, pulling...`);
      await this.pullImage(imageId);
    }
  }

  async createSecureContainer(
    options: ContainerCreateOptions,
  ): Promise<Dockerode.Container> {
    const {
      uid,
      gid,
      image,
      args,
      env,
      networkId,
      networkName,
      maxMemory,
      maxCpus,
    } = options;

    const envArray = Object.entries(env).map(
      ([key, value]) => `${key}=${value}`,
    );

    const containerOptions: Dockerode.ContainerCreateOptions = {
      Image: image,
      Cmd: args.length > 0 ? args : undefined,
      Env: envArray.length > 0 ? envArray : undefined,
      OpenStdin: true,
      User: `${uid}:${gid}`,
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
      },

      NetworkingConfig: {
        EndpointsConfig: {
          [networkName]: {
            NetworkID: networkId,
          },
        },
      },
    };

    if (maxMemory) {
      containerOptions.HostConfig!.Memory = maxMemory * 1024 * 1024;
    }

    if (maxCpus) {
      containerOptions.HostConfig!.NanoCpus = maxCpus * 1000000000;
    }

    return await this.docker.createContainer(containerOptions);
  }

  async startContainer(container: Dockerode.Container, deploymentId?: string) {
    await container.start();

    const stderr = new PassThrough();

    // stderr stream
    const stream = await container.attach({
      stream: true,
      stdout: false,
      stderr: true,
      stdin: false,
    });

    stream.pipe(stderr, { end: false });

    if (deploymentId) {
      // bind stderr after starting it
      stderr.on("data", async (chunk: any) => {
        const data = chunk.toString();

        await db.transaction(async (txn) => {
          const dplmt = await txn.query.Deployment.findFirst({
            where: (table, { eq }) => eq(table.id, deploymentId),
          });

          if (dplmt) {
            await txn
              .update(DeploymentTable)
              .set({ stderr: dplmt.stderr ? dplmt.stderr + data : data })
              .where(eq(DeploymentTable.id, deploymentId));
          }
        });
      });
    }
  }

  async stopContainer(
    containerId: string,
    graceful: boolean = true,
  ): Promise<void> {
    const container = this.docker.getContainer(containerId);

    if (graceful) {
      await container.stop({ t: 10 });
    } else {
      await container.kill();
    }
  }

  async removeContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    const [, removalError] = await tryCatchPromise(container.remove());

    // 404 is not a real error because it means container doesn't exist anymore
    if (
      removalError &&
      "statusCode" in removalError &&
      removalError.statusCode !== 404
    ) {
      throw removalError;
    }
  }

  inspectContainer(containerId: string) {
    return this.getContainer(containerId).inspect();
  }

  getContainer(containerId: string): Dockerode.Container {
    return this.docker.getContainer(containerId);
  }
}
