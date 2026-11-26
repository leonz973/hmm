import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayloadUser } from '../auth/current-user.decorator';
import { InsuranceService } from './insurance.service';
import { CreateInsuranceDto, UpdateInsuranceDto } from './dto';

@Controller('insurance')
@UseGuards(AuthGuard('jwt'))
export class InsuranceController {
  constructor(private readonly service: InsuranceService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.service.list(user.userId, hid);
  }

  @Post()
  create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateInsuranceDto, @Headers('x-household-id') hid?: string) {
    return this.service.create(user.userId, hid, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateInsuranceDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.service.update(user.userId, hid, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string, @Headers('x-household-id') hid?: string) {
    return this.service.remove(user.userId, hid, id);
  }
}
