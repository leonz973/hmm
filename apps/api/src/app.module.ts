import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    // 后续里程碑逐步挂载: AuthModule, HouseholdsModule, AssetsModule,
    // ExpensesModule, BillsModule, InvoicesModule, RemindersModule, UploadModule
  ],
  controllers: [HealthController],
})
export class AppModule {}
