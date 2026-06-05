import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { HttpError } from '../../common/exceptions/http-error';

@Injectable()
export class ClientsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Garante que o cliente existe E pertence à org. Joga 404 caso contrário. */
  async ensureClientOfOrg(clientId: string, orgId: string): Promise<void> {
    const svc = this.supabase.service();
    const { data } = await svc
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!data) throw new HttpError(404, 'Cliente não encontrado');
  }
}
