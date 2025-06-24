import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import { DeploymentService } from "./deployment.service";
import {
  CreateDeploymentBody,
  CreateDeploymentOkResponse,
  DeploymentListItem,
  DeploymentResponse,
} from "./deployment.types";

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
  async getDeployment(@Param("id") id: string): Promise<DeploymentResponse> {
    const deployment = this.deploymentService.getDeployment(id);

    if (!deployment) {
      return { deployment: null };
    }

    return {
      deployment,
    };
  }
}
