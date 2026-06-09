import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageService, type PresignedUpload } from "./storage.service";

const DEFAULT_PUT_TTL = 900;
const DEFAULT_GET_TTL = 3600;

/**
 * MinIO（S3 兼容）存储实现。
 * 浏览器与 api 同主机访问 MinIO（localhost:9000），故直传 URL 与服务端读写共用同一 endpoint。
 */
@Injectable()
export class MinioStorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    super();
    this.bucket = process.env.OSS_BUCKET ?? "cornerman";
    this.client = new S3Client({
      endpoint: process.env.OSS_ENDPOINT ?? "http://localhost:9000",
      region: process.env.OSS_REGION ?? "cn-hangzhou",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.OSS_ACCESS_KEY_ID ?? "cornerman",
        secretAccessKey: process.env.OSS_ACCESS_KEY_SECRET ?? "cornerman123"
      }
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucket();
    } catch (err) {
      this.logger.warn(
        `Bucket 初始化失败（可稍后重试）：${(err as Error).message}`
      );
    }
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`已创建 Bucket：${this.bucket}`);
    }
  }

  async presignPut(
    objectKey: string,
    contentType: string,
    expiresSec = DEFAULT_PUT_TTL
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresSec
    });
    return {
      url,
      headers: { "Content-Type": contentType },
      expiresIn: expiresSec
    };
  }

  async presignGet(objectKey: string, expiresSec = DEFAULT_GET_TTL): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresSec });
  }
}
