import { Global, Module } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { MinioStorageService } from "./minio-storage.service";

/**
 * 存储模块（全局）
 * 以 StorageService 抽象注入，当前绑定 MinIO 实现。
 */
@Global()
@Module({
  providers: [{ provide: StorageService, useClass: MinioStorageService }],
  exports: [StorageService]
})
export class StorageModule {}
