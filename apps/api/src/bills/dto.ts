import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export const BILL_TYPES = ['水费', '电费', '燃气费', '物业费', '其他'];

export class CreateBillDto {
  @IsIn(BILL_TYPES)
  type!: string;

  @IsString()
  @Length(7, 7)
  period!: string; // YYYY-MM

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  amountFen!: number;

  @IsOptional()
  @IsString()
  usage?: string;

  @IsOptional()
  @IsString()
  @Length(8, 10)
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateBillDto {
  @IsOptional() @IsIn(BILL_TYPES) type?: string;
  @IsOptional() @IsString() @Length(7, 7) period?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) amountFen?: number;
  @IsOptional() @IsString() usage?: string;
  @IsOptional() @IsString() @Length(8, 10) dueDate?: string;
  @IsOptional() @IsString() note?: string;
}
