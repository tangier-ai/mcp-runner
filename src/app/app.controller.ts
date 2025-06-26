import { Controller, Get, Res } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { Response } from "express";

@Controller()
export class AppController {
  @Get()
  @ApiExcludeEndpoint(true)
  redirectToSwagger(@Res() res: Response) {
    return res.redirect(302, "/api");
  }
}
