import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { SavingGoalsController } from './saving-goals.controller';
import { SavingGoalsService } from './saving-goals.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [SavingGoalsController],
  providers: [SavingGoalsService],
  exports: [SavingGoalsService],
})
export class SavingGoalsModule {}
