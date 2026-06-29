import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HealthModule } from './modules/health/health.module';
import { SupabaseModule } from './common/supabase/supabase.module';
import { OrgModule } from './common/org/org.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { MetaInfraModule } from './common/meta/meta-infra.module';
import { SupabaseAuthGuard } from './common/auth/supabase-auth.guard';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { DevModule } from './modules/_dev/dev.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ClientsModule } from './modules/clients/clients.module';
import { InvitesModule } from './modules/invites/invites.module';
import { PortalModule } from './modules/portal/portal.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { MetaModule } from './modules/meta/meta.module';
import { MembersModule } from './modules/members/members.module';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Common (global)
    SupabaseModule,
    OrgModule,
    CryptoModule,
    MetaInfraModule,
    // Feature modules
    HealthModule,
    OrganizationModule,
    ClientsModule,
    InvitesModule,
    PortalModule,
    AccountsModule,
    MetaModule,
    MembersModule,
    ...(isProd ? [] : [DevModule]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
