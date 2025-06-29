import { ApiKeyGuard } from "@/guards/api-key.guard";
import { DeploymentService } from "@/services/deployment.service";
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
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
@ApiSecurity("api-key")
@UseGuards(ApiKeyGuard)
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
  @ApiOperation({
    operationId: "createDeployment",
    summary: "Create a new deployment",
    description: "Creates a new deployment with the specified configuration.",
  })
  async createDeployment(@Body() body: CreateDeploymentBody) {
    const deployment = await this.deploymentService.createDeployment(body);

    return {
      deployment,
      message: "Deployment created successfully",
    };
  }

  @Get("/")
  @ApiOperation({
    operationId: "listDeployments",
    summary: "List all deployments",
    description: "Retrieves a list of all deployments with their basic information and status.",
  })
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
  @ApiOperation({
    operationId: "getDeployment",
    summary: "Get deployment details",
    description: "Retrieves detailed information about a specific deployment by its ID.",
  })
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
      throw new NotFoundException(`Deployment not found`);
    }

    return {
      deployment,
    };
  }

  @Delete("/:id")
  @ApiOperation({
    operationId: "deleteDeployment",
    summary: "Delete a deployment",
    description: "Deletes a deployment and cleans up all associated resources including containers, networks, and user accounts.",
  })
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
    const deployment = await this.deploymentService.getDeployment(id);

    if (!deployment) {
      throw new NotFoundException(`Deployment not found`);
    }

    await this.deploymentService.deleteDeployment(id);

    return {
      message: "Deployment deleted successfully",
    };
  }
}
