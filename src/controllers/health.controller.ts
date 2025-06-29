import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthOkResponse } from "./health.controller.types";

@Controller({
  path: "/health",
})
@ApiTags("Health")
export class HealthController {
  constructor() {}

  @Get("/")
  @ApiOperation({
    operationId: "getHealth",
    summary: "Health check",
    description: "Returns the health status of the API service.",
  })
  @ApiOkResponse({
    description: "The API is healthy",
    type: HealthOkResponse,
  })
  getHealth() {
    return {
      status: "ok",
    };
  }
}
