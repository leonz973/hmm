import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayloadUser } from '../auth/current-user.decorator';
import { SavingGoalsService } from './saving-goals.service';
import { CreateSavingGoalDto, UpdateSavingGoalDto } from './dto';

@Controller('saving-goals')
@UseGuards(AuthGuard('jwt'))
export class SavingGoalsController {
  constructor(private readonly service: SavingGoalsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.service.list(user.userId, hid);
  }

  @Post()
  create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateSavingGoalDto, @Headers('x-household-id') hid?: string) {
    return this.service.create(user.userId, hid, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateSavingGoalDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.service.update(user.userId, hid, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string, @Headers('x-household-id') hid?: string) {
    return this.service.remove(user.userId, hid, id);
  }
}
