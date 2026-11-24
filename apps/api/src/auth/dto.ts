import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不对' })
  email!: string;

  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(72, { message: '密码最多 72 位' })
  password!: string;

  @IsString()
  @MinLength(1, { message: '昵称不能为空' })
  @MaxLength(20)
  displayName!: string;
}

export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不对' })
  email!: string;

  @IsString()
  @MinLength(1, { message: '请输入密码' })
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(10, { message: 'refreshToken 缺失' })
  refreshToken!: string;
}
