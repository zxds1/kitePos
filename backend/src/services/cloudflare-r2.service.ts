import { randomUUID } from "node:crypto"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

type UploadImageInput = {
  buffer: Buffer
  contentType: string
  fileName: string
  context: string
  shopId: string
}

export type UploadImageResult = {
  key: string
  url: string
  bucket: string
  contentType: string
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required storage configuration: ${name}`)
  }
  return value
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/\s+/g, "-")
  const safe = trimmed.replace(/[^A-Za-z0-9._-]/g, "")
  return safe.length > 0 ? safe : "upload"
}

function normalizeContext(context: string): string {
  const safe = context.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-")
  return safe.length > 0 ? safe : "other"
}

export class CloudflareR2Service {
  private client: S3Client
  private bucket: string
  private publicBaseUrl: string

  constructor() {
    const accountId = getRequiredEnv("CLOUDFLARE_R2_ACCOUNT_ID")
    const accessKeyId = getRequiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID")
    const secretAccessKey = getRequiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY")

    this.bucket = getRequiredEnv("CLOUDFLARE_R2_BUCKET_NAME")
    this.publicBaseUrl = getRequiredEnv("CLOUDFLARE_R2_PUBLIC_BASE_URL").replace(
      /\/+$/,
      ""
    )

    const endpoint =
      process.env.CLOUDFLARE_R2_ENDPOINT?.trim() ||
      `https://${accountId}.r2.cloudflarestorage.com`

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    })
  }

  async uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
    const date = new Date()
    const folder = [
      normalizeContext(input.context),
      input.shopId.trim(),
      String(date.getUTCFullYear()),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("/")

    const extension = this.extensionForContentType(input.contentType)
    const originalName = sanitizeFileName(input.fileName)
    const lastDot = originalName.lastIndexOf(".")
    const baseName =
      lastDot > 0 ? originalName.slice(0, lastDot) : originalName
    const key = `${folder}/${randomUUID()}-${baseName}${extension}`

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
      })
    )

    return {
      key,
      url: `${this.publicBaseUrl}/${key}`,
      bucket: this.bucket,
      contentType: input.contentType,
    }
  }

  private extensionForContentType(contentType: string): string {
    switch (contentType) {
      case "image/jpeg":
        return ".jpg"
      case "image/png":
        return ".png"
      case "image/webp":
        return ".webp"
      case "image/gif":
        return ".gif"
      case "image/heic":
        return ".heic"
      case "image/heif":
        return ".heif"
      case "image/avif":
        return ".avif"
      case "image/bmp":
        return ".bmp"
      case "image/tiff":
        return ".tiff"
      default:
        return ""
    }
  }
}

export default CloudflareR2Service
