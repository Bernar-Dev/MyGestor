import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { OrgModule } from '../../common/org/org.module';
import { SupabaseModule } from '../../common/supabase/supabase.module';

@Module({
  imports: [OrgModule, SupabaseModule],
  controllers: [MembersController],
})
export class MembersModule {}
