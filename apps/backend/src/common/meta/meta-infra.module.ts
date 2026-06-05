import { Global, Module } from '@nestjs/common';
import { MetaStoreService } from './meta-store.service';
import { MetaApiService } from './meta-api.service';

@Global()
@Module({
  providers: [MetaStoreService, MetaApiService],
  exports: [MetaStoreService, MetaApiService],
})
export class MetaInfraModule {}
