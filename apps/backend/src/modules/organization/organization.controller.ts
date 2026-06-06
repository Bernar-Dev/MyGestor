import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { CurrentSession } from '../../common/auth/current-session.decorator';
import { OrgService } from '../../common/org/org.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { HttpError } from '../../common/exceptions/http-error';
import { CreateOrgBody, PatchOrgBody } from './dto';
import type { AuthUser, SessionOrPending } from '../../common/org/types';

@Controller('org')
export class OrganizationController {
  constructor(
    private readonly org: OrgService,
    private readonly supabase: SupabaseService,
  ) {}

  @Get()
  async get(@CurrentSession() session: SessionOrPending | null) {
    const sess = this.org.requireAgency(session);
    const svc = this.supabase.service();
    const { data } = await svc
      .from('organizations')
      .select(
        'id, name, slug, plan, logo_url, primary_color, max_clients, max_ad_accounts, created_at',
      )
      .eq('id', sess.orgId)
      .maybeSingle();
    return { org: data, role: sess.orgRole };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateOrgBody)) body: CreateOrgBody,
  ) {
    const svc = this.supabase.service();
    const { data: existing } = await svc
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (existing) throw new HttpError(409, 'Você já pertence a uma organização');

    const org = await this.org.createOrganization({
      userId: user.id,
      name: body.name,
    });
    return { ok: true, org };
  }

  @Patch()
  async update(
    @CurrentSession() session: SessionOrPending | null,
    @Body(new ZodValidationPipe(PatchOrgBody)) body: PatchOrgBody,
  ) {
    const sess = this.org.requireAgency(session);
    if (sess.orgRole !== 'owner') {
      throw new HttpError(403, 'Apenas owners podem editar a org');
    }

    const svc = this.supabase.service();
    const { error } = await svc
      .from('organizations')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', sess.orgId);
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  }
}
