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
import { AssetsService } from './assets.service';
import { CreateAssetDto, UpdateAssetDto } from './dto';

@Controller('assets')
@UseGuards(AuthGuard('jwt'))
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser, @Headers('x-household-id') hid?: string) {
    return this.assets.list(user.userId, hid);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateAssetDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.assets.create(user.userId, hid, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.assets.update(user.userId, hid, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Headers('x-household-id') hid?: string,
  ) {
    return this.assets.remove(user.userId, hid, id);
  }
}
