import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateMaintenanceDto {
  @IsString()
  @Length(1, 40)
  assetId!: string;

  @IsString()
  @Length(1, 30)
  title!: string;

  @IsInt()
  @Min(1)
  @Max(120)
  intervalMonths!: number;

  /** 上次做的时间，不填默认今天 */
  @IsOptional()
  @IsString()
  @Length(8, 10)
  lastDoneDate?: string;

  /** 直接指定下次到期日（不填就按 lastDoneDate + interval 算） */
  @IsOptional()
  @IsString()
  @Length(8, 10)
  nextDueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateMaintenanceDto {
  @IsOptional() @IsString() @Length(1, 30) title?: string;
  @IsOptional() @IsInt() @Min(1) @Max(120) intervalMonths?: number;
  @IsOptional() @IsString() @Length(8, 10) lastDoneDate?: string;
  @IsOptional() @IsString() @Length(8, 10) nextDueDate?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class DoneMaintenanceDto {
  /** 完成日期，不填默认今天 */
  @IsOptional()
  @IsString()
  @Length(8, 10)
  doneDate?: string;
}
