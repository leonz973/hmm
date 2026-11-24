import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export const CYCLES = ['每月', '每季', '每半年', '每年'];

export class CreateFixedExpenseDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  amountFen!: number;

  @IsIn(CYCLES)
  cycle!: string;

  @IsString()
  @Length(8, 10)
  dueDate!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  autoPay?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateFixedExpenseDto {
  @IsOptional() @IsString() @Length(1, 40) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) amountFen?: number;
  @IsOptional() @IsIn(CYCLES) cycle?: string;
  @IsOptional() @IsString() @Length(8, 10) dueDate?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() autoPay?: boolean;
  @IsOptional() @IsString() note?: string;
}
