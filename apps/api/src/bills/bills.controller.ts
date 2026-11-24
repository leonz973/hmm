import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayloadUser } from '../auth/current-user.decorator';
import { BillsService } from './bills.service';
import { CreateBillDto, UpdateBillDto } from './dto';

@Controller('bills')
@UseGuards(AuthGuard('jwt'))
export class BillsController {
  constructor(private readonly service: BillsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.service.list(user.userId, hid);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateBillDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.service.create(user.userId, hid, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateBillDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.service.update(user.userId, hid, id, dto);
  }

  @Post(':id/pay')
  pay(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string, @Headers('x-household-id') hid?: string) {
    return this.service.setPaid(user.userId, hid, id, true);
  }

  @Post(':id/unpay')
  unpay(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string, @Headers('x-household-id') hid?: string) {
    return this.service.setPaid(user.userId, hid, id, false);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.service.remove(user.userId, hid, id);
  }
}
