import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateSavingGoalDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  targetFen!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  savedFen?: number;

  @IsString()
  @Length(8, 10)
  targetDate!: string;

  @IsOptional()
  @IsString()
  linkedAssetId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateSavingGoalDto {
  @IsOptional() @IsString() @Length(1, 40) name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000_000) targetFen?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) savedFen?: number;
  @IsOptional() @IsString() @Length(8, 10) targetDate?: string;
  @IsOptional() @IsString() linkedAssetId?: string;
  @IsOptional() @IsString() note?: string;
}
