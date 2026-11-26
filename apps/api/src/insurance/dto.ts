import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateInsuranceDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsString()
  @Length(1, 20)
  kind!: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  company?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  coverageFen?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  premiumFen?: number;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  cycle?: string;

  @IsString()
  @Length(8, 10)
  startDate!: string;

  @IsString()
  @Length(8, 10)
  endDate!: string;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  contact?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateInsuranceDto {
  @IsOptional() @IsString() @Length(1, 60) name?: string;
  @IsOptional() @IsString() @Length(1, 20) kind?: string;
  @IsOptional() @IsString() @Length(0, 40) company?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) coverageFen?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) premiumFen?: number;
  @IsOptional() @IsString() @Length(1, 10) cycle?: string;
  @IsOptional() @IsString() @Length(8, 10) startDate?: string;
  @IsOptional() @IsString() @Length(8, 10) endDate?: string;
  @IsOptional() @IsString() @Length(0, 60) contact?: string;
  @IsOptional() @IsString() note?: string;
}
