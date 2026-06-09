import { Injectable } from "@nestjs/common";

export interface PresignedUpload {
  url: string;
  headers: Record<string, string>;
  expiresIn: number;
}

/**
 * 对象存储抽象。
 * 当前实现为 MinIO（S3 兼容，本地替代阿里云 OSS）；
 * 生产可新增 AliyunOssStorageService（STS 临时凭证 + 私有 Bucket），接口不变。
 */
@Injectable()
export abstract class StorageService {
  /** 启动时确保 Bucket 存在 */
  abstract ensureBucket(): Promise<void>;
  /** 预签名 PUT，供浏览器直传 */
  abstract presignPut(
    objectKey: string,
    contentType: string,
    expiresSec?: number
  ): Promise<PresignedUpload>;
  /** 预签名 GET，供浏览器读取私有对象 */
  abstract presignGet(objectKey: string, expiresSec?: number): Promise<string>;
}
