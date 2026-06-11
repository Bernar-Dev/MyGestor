import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { SupabaseModule } from '../../common/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AccountsController],
})
export class AccountsModule {}
