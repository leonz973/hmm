import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAssetDto {
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  @MaxLength(40)
  name!: string;

  @IsOptional()
  @IsString()
  categoryKey?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  location?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: '购买日期格式应为 YYYY-MM-DD' })
  purchaseDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99_999_999_00)
  priceFen?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  warrantyMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  expectedLifeMonths?: number;

  @IsOptional()
  @IsIn(['low', 'mid', 'high'], { message: '使用强度只能是 low / mid / high' })
  usageLevel?: 'low' | 'mid' | 'high';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

/** 部分更新：所有字段可选，只改传上来的那些 */
export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  categoryKey?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  location?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: '购买日期格式应为 YYYY-MM-DD' })
  purchaseDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99_999_999_00)
  priceFen?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  warrantyMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  expectedLifeMonths?: number;

  @IsOptional()
  @IsIn(['low', 'mid', 'high'])
  usageLevel?: 'low' | 'mid' | 'high';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
