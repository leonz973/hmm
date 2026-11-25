import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AssetsModule } from './assets/assets.module';
import { FixedExpensesModule } from './fixed-expenses/fixed-expenses.module';
import { BillsModule } from './bills/bills.module';
import { InvoicesModule } from './invoices/invoices.module';
import { RemindersModule } from './reminders/reminders.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { MailerModule } from './mailer/mailer.module';
import { HealthController } from './health.controller';
import { HouseholdsModule } from './households/households.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MailerModule,
    PrismaModule,
    AuthModule,
    HouseholdsModule,
    AssetsModule,
    FixedExpensesModule,
    BillsModule,
    InvoicesModule,
    RemindersModule,
    AttachmentsModule,
    // 后续：CategoriesModule / RemindersModule（cron 06:00）/ StorageModule（MinIO 预签名）/ ExportModule
  ],
  controllers: [HealthController],
})
export class AppModule {}
