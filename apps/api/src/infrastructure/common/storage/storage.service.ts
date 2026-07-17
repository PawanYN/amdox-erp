import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';

/**
 * Durable object storage for invoice attachments and payslip PDFs (Tech
 * Stack "File Storage" gap). Talks to any S3-compatible endpoint via the
 * standard AWS SDK — MinIO in dev/kind, swap STORAGE_* env vars to point at
 * real AWS S3 (or Cloudflare R2) in production with no code changes.
 *
 * Buckets are never made public: every read proxies through this service
 * and an authenticated, tenant-scoped API endpoint, matching how the rest
 * of the app already gates file access (no presigned public URLs).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET || 'amdox-erp';
    this.client = new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
      region: process.env.STORAGE_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY || 'amdox',
        secretAccessKey: process.env.STORAGE_SECRET_KEY || 'amdox_dev_123',
      },
      // MinIO (and most S3-compatible stores) require path-style addressing
      // (http://host/bucket/key) rather than AWS's virtual-hosted-style
      // (http://bucket.host/key).
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created storage bucket "${this.bucket}"`);
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const stream = result.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
