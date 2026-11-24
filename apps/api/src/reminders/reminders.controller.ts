import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayloadUser } from '../auth/current-user.decorator';
import { HouseholdsService } from '../households/households.service';
import { RemindersService } from './reminders.service';

@Controller('reminders')
@UseGuards(AuthGuard('jwt'))
export class RemindersController {
  constructor(
    private readonly service: RemindersService,
    private readonly households: HouseholdsService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.service.listForUser(user.userId, hid);
  }

  /** 手动跑一次（开发调试 / 用户点「现在就提醒我」） */
  @Post('run')
  async run(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { dryRun?: boolean },
    @Headers('x-household-id') hid?: string,
  ) {
    const { household } = await this.households.resolve(user.userId, hid);
    return this.service.run(household.id, { trigger: 'manual', dryRun: body?.dryRun });
  }
}
