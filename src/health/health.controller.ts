import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { HealthOkResponse } from "./health.controller.types";

@Controller({
  path: "/health",
})
@ApiTags("Health")
export class HealthController {
  constructor() {}

  @Get("/")
  @ApiOkResponse({
    description: "The API is healthy",
    type: HealthOkResponse,
  })
  @ApiOkResponse({})
  getHealth() {
    return {
      status: "ok",
    };
  }
}
