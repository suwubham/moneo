import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { settings } from "@/lib/core/config";

// Cloudflare R2 speaks the S3 API. The bucket is private: files only leave it through /api/files/[id].
let client: S3Client | null = null;

function r2() {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${settings.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: settings.r2AccessKeyId!, secretAccessKey: settings.r2SecretAccessKey! },
  });
  return client;
}

export type FileStore = {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; bytes?: number } | null>;
  deletePrefix(prefix: string): Promise<void>;
};

export const r2Store: FileStore = {
  async put(key, body, contentType) {
    await r2().send(new PutObjectCommand({ Bucket: settings.r2Bucket, Key: key, Body: body, ContentType: contentType }));
  },

  async get(key) {
    try {
      const out = await r2().send(new GetObjectCommand({ Bucket: settings.r2Bucket, Key: key }));
      if (!out.Body) return null;
      return { body: out.Body.transformToWebStream(), bytes: out.ContentLength };
    } catch (err) {
      if (err instanceof Error && err.name === "NoSuchKey") return null;
      throw err;
    }
  },

  async deletePrefix(prefix) {
    let token: string | undefined;
    do {
      const page = await r2().send(new ListObjectsV2Command({ Bucket: settings.r2Bucket, Prefix: prefix, ContinuationToken: token }));
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
      if (keys.length) await r2().send(new DeleteObjectsCommand({ Bucket: settings.r2Bucket, Delete: { Objects: keys, Quiet: true } }));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  },
};

export const fileKey = (userId: string, conversationId: string, fileId: string) => `u/${userId}/c/${conversationId}/${fileId}`;
export const conversationPrefix = (userId: string, conversationId: string) => `u/${userId}/c/${conversationId}/`;
export const userPrefix = (userId: string) => `u/${userId}/`;
