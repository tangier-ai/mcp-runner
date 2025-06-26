import { DeploymentService } from "@/services/deployment.service";
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  CreateDeploymentBody,
  CreateDeploymentOkResponse,
  DeleteDeploymentResponse,
  DeploymentListItem,
  DeploymentResponse,
  NotFoundResponse,
} from "./deployment.controller.types";

@Controller({
  path: "/api/deployment",
})
@ApiTags("Deployment")
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  @Post("/")
  @ApiBody({
    required: true,
    type: CreateDeploymentBody,
  })
  @ApiOkResponse({
    type: CreateDeploymentOkResponse,
  })
  async createDeployment(@Body() body: CreateDeploymentBody) {
    const deploymentId = await this.deploymentService.createDeployment(body);

    return {
      id: deploymentId,
      message: "Deployment created successfully",
    };
  }

  @Get("/")
  @ApiOkResponse({
    type: DeploymentListItem,
    isArray: true,
    description: "List of all deployments with basic information",
  })
  async listDeployments(): Promise<DeploymentListItem[]> {
    const deployments = this.deploymentService.getAllDeployments();
    return deployments.map((deployment) => ({
      id: deployment.id,
      image: deployment.image,
      userGid: deployment.gid,
    }));
  }

  @Get("/:id")
  @ApiParam({
    name: "id",
    type: String,
    description: "The deployment ID",
  })
  @ApiOkResponse({
    type: DeploymentResponse,
    description: "Detailed information about a specific deployment",
  })
  @ApiNotFoundResponse({
    type: NotFoundResponse,
    description: "Deployment not found",
  })
  async getDeployment(@Param("id") id: string): Promise<DeploymentResponse> {
    const deployment = this.deploymentService.getDeployment(id);

    if (!deployment) {
      throw new NotFoundException(`Deployment with ID ${id} not found`);
    }

    return {
      deployment,
    };
  }

  @Delete("/:id")
  @ApiParam({
    name: "id",
    type: String,
    description: "The deployment ID to delete",
  })
  @ApiOkResponse({
    type: DeleteDeploymentResponse,
    description: "Deployment deleted successfully",
  })
  @ApiNotFoundResponse({
    type: NotFoundResponse,
    description: "Deployment not found",
  })
  async deleteDeployment(
    @Param("id") id: string,
  ): Promise<DeleteDeploymentResponse> {
    const deployment = this.deploymentService.getDeployment(id);

    if (!deployment) {
      throw new NotFoundException(`Deployment with ID ${id} not found`);
    }

    await this.deploymentService.deleteDeployment(id);

    return {
      message: "Deployment deleted successfully",
    };
  }
}
