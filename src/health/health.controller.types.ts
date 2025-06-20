import { ApiProperty } from "@nestjs/swagger";

export class HealthOkResponse {
  @ApiProperty({
    required: true,
    type: String,
    example: "ok",
  })
  status: string;
}
