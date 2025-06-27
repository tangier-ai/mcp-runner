import { tryCatchPromise } from "@/utils/try-catch-promise";
import { Injectable } from "@nestjs/common";
import Dockerode from "dockerode";

@Injectable()
export class NetworkService {
  private readonly docker: Dockerode;

  constructor() {
    this.docker = new Dockerode();
  }

  getNetworkName(deploymentId: string): string {
    return `${deploymentId}-network`;
  }

  async createIsolatedNetwork(deploymentId: string) {
    const Name = this.getNetworkName(deploymentId);

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

  async cleanupNetwork(deploymentId: string): Promise<void> {
    const networkName = this.getNetworkName(deploymentId);

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
}
