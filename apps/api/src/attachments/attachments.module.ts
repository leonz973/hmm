import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { HouseholdsModule } from '../households/households.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [HouseholdsModule, InvoicesModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
