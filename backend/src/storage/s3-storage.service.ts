import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('S3_ENDPOINT');
    const region = config.get<string>('S3_REGION') || 'us-east-1';
    this.bucket = config.get<string>('S3_BUCKET') || '';
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      ...(config.get<string>('S3_ACCESS_KEY_ID') &&
      config.get<string>('S3_SECRET_ACCESS_KEY')
        ? {
            credentials: {
              accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
              secretAccessKey: config.getOrThrow<string>(
                'S3_SECRET_ACCESS_KEY',
              ),
            },
          }
        : {}),
    });
  }

  isConfigured() {
    return Boolean(this.bucket);
  }

  async createUploadUrl(key: string, contentType: string) {
    this.assertConfigured();
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 300 },
    );
  }

  async inspectObject(key: string) {
    this.assertConfigured();
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const sample = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: 'bytes=0-31',
      }),
    );
    const bytes = sample.Body ? await sample.Body.transformToByteArray() : new Uint8Array();
    return {
      size: head.ContentLength ?? -1,
      contentType: head.ContentType ?? '',
      signature: bytes,
    };
  }

  async createDownloadUrl(key: string, filename: string) {
    this.assertConfigured();
    const safeFilename = encodeURIComponent(filename).replace(/'/g, '%27');
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${safeFilename}`,
      }),
      { expiresIn: 300 },
    );
  }

  async deleteObject(key: string) {
    this.assertConfigured();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  private assertConfigured() {
    if (!this.bucket) {
      throw new ServiceUnavailableException(
        'Task attachments are not configured. Set the S3 storage environment variables.',
      );
    }
  }
}
