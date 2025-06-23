import { Injectable } from "@nestjs/common";
import Dockerode from "dockerode";

@Injectable()
export class ContainerService {
  private docker: Dockerode;

  constructor() {
    this.docker = new Dockerode();
  }

  // simple method to create a container, gives back the ID of the container
  async createContainer(image: string): Promise<string> {
    const container = await this.docker.createContainer({
      Image: image,
    });

    return container.id;
  }
}
