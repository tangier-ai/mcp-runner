import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class CreateContainerBody {
  @IsString({
    message: "Image must be a string",
  })
  @ApiProperty({
    type: String,
    required: true,
    example: "mcp/time:latest",
    description: "The Docker image to use for the container",
  })
  @Matches(/^[a-z0-9\/._-]+:[a-z0-9._-]+$/, {
    message: "Image must contain a tag in the format 'name:tag'",
  })
  image: string;
}

export class CreateContainerOkResponse {
  @ApiProperty({
    type: String,
    required: true,
    example: "1234567890abcdef",
    description: "The ID of the created container",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    example: "Container created successfully",
    description: "A message indicating the result of the operation",
  })
  message: string;
}
