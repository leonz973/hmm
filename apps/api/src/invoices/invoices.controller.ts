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
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'))
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.service.list(user.userId, hid);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateInvoiceDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.service.create(user.userId, hid, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
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
