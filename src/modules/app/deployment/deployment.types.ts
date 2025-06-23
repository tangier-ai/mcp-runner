import { ApiProperty } from "@nestjs/swagger";
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from "class-validator";

export class CreateDeploymentBody {
  @IsString({
    message: "Image ID must be a string",
  })
  @ApiProperty({
    type: String,
    required: true,
    example: "mcp/time:latest",
    description: "The Docker image ID to use for the deployment",
  })
  @Matches(/^[a-z0-9\/._-]+:[a-z0-9._-]+$/, {
    message: "Image must contain a tag in the format 'name:tag'",
  })
  imageId: string;

  @IsOptional()
  @IsString({ each: true })
  @ApiProperty({
    type: [String],
    required: false,
    example: ["--verbose", "--config=/app/config.json"],
    description: "Command line arguments for the deployment",
  })
  args?: string[];

  @IsOptional()
  @IsObject()
  @ApiProperty({
    type: Object,
    required: false,
    example: { NODE_ENV: "production", PORT: "3000" },
    description: "Environment variables for the deployment",
  })
  envVars?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @ApiProperty({
    type: Number,
    required: false,
    example: 512,
    description: "Maximum memory in MB for the deployment",
  })
  maxMemory?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @ApiProperty({
    type: Number,
    required: false,
    example: 1.5,
    description: "Maximum CPU cores for the deployment",
  })
  maxCpus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({
    type: Number,
    required: false,
    example: 3600000,
    description:
      "Maximum inactivity time in milliseconds before auto-deletion (null for no auto-deletion)",
    nullable: true,
  })
  maxInactivityDeletion?: number | null;

  @IsOptional()
  @IsObject()
  @ApiProperty({
    type: Object,
    required: false,
    example: { userId: "usr_1234567890", version: "1.0.0" },
    description: "Optional metadata for the deployment",
  })
  metadata?: Record<string, any>;
}

export class CreateDeploymentOkResponse {
  @ApiProperty({
    type: String,
    required: true,
    example: "deployment-1234567890abcdef",
    description: "The ID of the created deployment",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    example: "Deployment created successfully",
    description: "A message indicating the result of the operation",
  })
  message: string;
}

export class DeploymentInfo {
  // Unique deployment identifier
  @IsString()
  id: string;

  // Docker container ID
  @IsString()
  containerId: string;

  // Docker image ID used for the deployment
  @IsString()
  imageId: string;

  // Username of the unprivileged user created for this deployment
  @IsString()
  username: string;

  // User ID of the unprivileged user
  @IsNumber()
  uid: number;

  // Group ID of the unprivileged user
  @IsNumber()
  gid: number;

  // Command line arguments passed to the container
  @IsOptional()
  @IsString({ each: true })
  args?: string[];

  // Environment variables for the container
  @IsOptional()
  @IsObject()
  envVars?: Record<string, string>;

  // Maximum memory limit in MB
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxMemory?: number;

  // Maximum CPU cores limit
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  maxCpus?: number;

  // Auto-deletion timeout in milliseconds after last interaction
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxInactivityDeletion?: number | null;

  // Timestamp when the deployment was created
  createdAt: Date;

  // Timestamp of the last interaction with the deployment
  lastInteraction: Date;

  // Optional metadata for the deployment
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class DeploymentListItem {
  @ApiProperty({
    type: String,
    required: true,
    example: "deployment-1234567890abcdef",
    description: "The ID of the deployment",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    example: "mcp/time:latest",
    description: "The Docker image ID used for the deployment",
  })
  image: string;

  @ApiProperty({
    type: Number,
    required: true,
    example: 1001,
    description: "The GID of the unprivileged user for this deployment",
  })
  userGid: number;
}

export class DeploymentResponse {
  @ApiProperty({
    type: String,
    required: true,
    example: "deployment-1234567890abcdef",
    description: "The ID of the deployment",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    example: "mcp/time:latest",
    description: "The Docker image ID used for the deployment",
  })
  imageId: string;

  @ApiProperty({
    type: Number,
    required: true,
    example: 1001,
    description: "The GID of the unprivileged user for this deployment",
  })
  userGid: number;

  @ApiProperty({
    type: Object,
    required: false,
    example: { project: "my-app", version: "1.0.0" },
    description: "Optional metadata for the deployment",
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    type: Date,
    required: true,
    example: "2023-01-01T00:00:00.000Z",
    description: "Timestamp when the deployment was created",
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
    required: true,
    example: "2023-01-01T00:00:00.000Z",
    description: "Timestamp of the last interaction with the deployment",
  })
  lastInteraction: Date;
}
