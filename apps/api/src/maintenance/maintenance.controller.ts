import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayloadUser } from '../auth/current-user.decorator';
import { CreateMaintenanceDto, DoneMaintenanceDto, UpdateMaintenanceDto } from './dto';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
@UseGuards(AuthGuard('jwt'))
export class MaintenanceController {
  constructor(private readonly plans: MaintenanceService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayloadUser,
    @Query('assetId') assetId?: string,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.plans.list(user.userId, hid, assetId);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateMaintenanceDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.plans.create(user.userId, hid, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.plans.update(user.userId, hid, id, dto);
  }

  @Post(':id/done')
  done(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: DoneMaintenanceDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.plans.done(user.userId, hid, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.plans.remove(user.userId, hid, id);
  }
}
