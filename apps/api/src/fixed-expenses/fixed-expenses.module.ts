import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { FixedExpensesController } from './fixed-expenses.controller';
import { FixedExpensesService } from './fixed-expenses.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [FixedExpensesController],
  providers: [FixedExpensesService],
})
export class FixedExpensesModule {}
