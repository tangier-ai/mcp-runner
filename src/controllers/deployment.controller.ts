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
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  CreateDeploymentBody,
  CreateDeploymentOkResponse,
  DeleteDeploymentResponse,
  DeploymentData,
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
  @ApiCreatedResponse({
    type: CreateDeploymentOkResponse,
  })
  async createDeployment(@Body() body: CreateDeploymentBody) {
    const deployment = await this.deploymentService.createDeployment(body);

    return {
      deployment,
      message: "Deployment created successfully",
    };
  }

  @Get("/")
  @ApiOkResponse({
    type: DeploymentData,
    isArray: true,
    description: "List of all deployments with basic information",
  })
  async listDeployments(): Promise<DeploymentData[]> {
    const deployments = await this.deploymentService.getAllDeployments();

    return deployments.map((deployment) => ({
      ...deployment,
      pause_at: deployment.pause_at?.toISOString() || null,
      delete_at: deployment.delete_at?.toISOString() || null,
      created_at: deployment.created_at.toISOString(),
      last_interaction_at: deployment.last_interaction_at.toISOString(),
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
    const deployment = await this.deploymentService.getDeployment(id);

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
