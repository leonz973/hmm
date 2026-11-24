import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
