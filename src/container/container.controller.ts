import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ContainerService } from "./container.service";
import {
  CreateContainerBody,
  CreateContainerOkResponse,
} from "./container.types";

@Controller({
  path: "container",
})
@ApiTags("Container")
export class ContainerController {
  constructor(private readonly containerService: ContainerService) {}

  @Post("/")
  @ApiBody({
    required: true,
    type: CreateContainerBody,
  })
  @ApiOkResponse({
    type: CreateContainerOkResponse,
  })
  async createContainer(@Body() body: CreateContainerBody) {
    const containerId = await this.containerService.createContainer(body.image);

    return {
      id: containerId,
      message: "Container created successfully",
    };
  }
}
