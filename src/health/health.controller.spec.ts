import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthOkResponse } from "./health.controller.types";

// simple test for the HealthController as a reference
describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getHealth", () => {
    it("should return health status with correct type", () => {
      const result = controller.getHealth();

      expect(result).toBeDefined();
      expect(result).toHaveProperty("status");
      expect(typeof result.status).toBe("string");
      expect(result.status).toBe("ok");
    });

    it("should return response matching HealthOkResponse type", () => {
      const result = controller.getHealth();

      const expectedResponse: HealthOkResponse = {
        status: "ok",
      };

      expect(result).toEqual(expectedResponse);
    });
  });
});
