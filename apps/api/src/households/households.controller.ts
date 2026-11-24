import { Body, Controller, Get, Headers, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, JwtPayloadUser } from '../auth/current-user.decorator';
import { HouseholdsService } from './households.service';

class RenameDto {
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  @MaxLength(30, { message: '最多 30 个字' })
  name!: string;
}

class JoinDto {
  @IsString()
  @MinLength(4, { message: '邀请码不对' })
  code!: string;
}

@Controller('households')
@UseGuards(AuthGuard('jwt'))
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get('current')
  current(@CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.households.current(user.userId, hid);
  }

  @Patch('current')
  rename(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: RenameDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.households.rename(user.userId, hid, dto.name);
  }

  @Patch('current/settings')
  updateSettings(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { warrantyLeadDays?: number; replaceLeadDays?: number; notifyEmail?: boolean },
    @Headers('x-household-id') hid?: string,
  ) {
    return this.households.updateSettings(user.userId, hid, body ?? {});
  }

  @Post('invites')
  invite(@CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.households.createInvite(user.userId, hid);
  }

  @Post('join')
  join(@CurrentUser() user: JwtPayloadUser, @Body() dto: JoinDto) {
    return this.households.join(user.userId, dto.code);
  }
}
