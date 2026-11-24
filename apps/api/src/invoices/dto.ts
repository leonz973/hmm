import { IsArray, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @Length(1, 60)
  seller!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  amountFen!: number;

  @IsString()
  @Length(8, 10)
  date!: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assetIds?: string[];

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  blobKey?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateInvoiceDto {
  @IsOptional() @IsString() @Length(1, 60) seller?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) amountFen?: number;
  @IsOptional() @IsString() @Length(8, 10) date?: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) assetIds?: string[];
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() fileType?: string;
  @IsOptional() @IsInt() @Min(0) fileSize?: number;
  @IsOptional() @IsString() blobKey?: string;
  @IsOptional() @IsString() note?: string;
}
