import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class TokenResponseDto {
  @ApiProperty({ description: "Access token (kısa süreli)" })
  accessToken: string;

  @ApiProperty({ description: "Refresh token (uzun süreli)" })
  refreshToken: string;

  @ApiProperty({ description: "Access token süresi (saniye)" })
  expiresIn: number;
}
