import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

const bucket = process.env.OSS_BUCKET ?? "cornerman";

const client = new S3Client({
  endpoint: process.env.OSS_ENDPOINT ?? "http://localhost:9000",
  region: process.env.OSS_REGION ?? "cn-hangzhou",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID ?? "cornerman",
    secretAccessKey: process.env.OSS_ACCESS_KEY_SECRET ?? "cornerman123"
  }
});

export async function downloadObject(
  objectKey: string,
  destPath: string
): Promise<void> {
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: objectKey })
  );
  if (!res.Body) {
    throw new Error(`对象为空：${objectKey}`);
  }
  await pipeline(res.Body as Readable, createWriteStream(destPath));
}

export async function uploadFile(
  localPath: string,
  objectKey: string,
  contentType: string
): Promise<void> {
  const body = await readFile(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType
    })
  );
}
