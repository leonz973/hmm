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
import { FixedExpensesService } from './fixed-expenses.service';
import { CreateFixedExpenseDto, UpdateFixedExpenseDto } from './dto';

@Controller('fixed-expenses')
@UseGuards(AuthGuard('jwt'))
export class FixedExpensesController {
  constructor(private readonly service: FixedExpensesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.service.list(user.userId, hid);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateFixedExpenseDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.service.create(user.userId, hid, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateFixedExpenseDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.service.update(user.userId, hid, id, dto);
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
