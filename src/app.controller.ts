import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";

@Controller()
export class AppController {
  @Get("/")
  redirectToSwagger(@Res() res: Response) {
    return res.redirect(302, "/api");
  }
}
