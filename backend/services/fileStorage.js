/**
 * FileStorageService — AWS S3 backed file storage.
 * All uploads go to the S3 bucket defined in AWS_S3_BUCKET.
 * Files are stored under the `uploads/` prefix in the bucket.
 */

const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_FILE_BYTES      = 25 * 1024 * 1024; // 25 MB

/** Validate MIME type and size. Throws with .status = 400 if invalid. */
function validate(mimetype, size) {
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    throw Object.assign(
      new Error(`File type "${mimetype}" is not allowed. Accepted: PDF, JPEG, PNG.`),
      { status: 400 }
    );
  }
  if (size > MAX_FILE_BYTES) {
    throw Object.assign(new Error('File is too large. Maximum size is 25 MB.'), { status: 400 });
  }
}

/**
 * Upload a multer file (memoryStorage) to S3.
 * @param {object} multerFile  - req.file from multer memoryStorage
 * @returns {{ url: string, key: string, size: number }}
 */
async function store(multerFile) {
  const ext  = path.extname(multerFile.originalname).toLowerCase();
  const base = path.basename(multerFile.originalname, ext)
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 80);
  const key  = `uploads/${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        multerFile.buffer,
    ContentType: multerFile.mimetype,
  }));

  const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  console.log(`☁️  S3 upload: ${key} (${(multerFile.size / 1024).toFixed(1)} KB)`);
  return { url, key, size: multerFile.size };
}

/**
 * Delete a file from S3 by its key.
 * @param {string} key  - S3 object key (e.g. "uploads/1234-foo.pdf")
 */
async function deleteFile(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    console.log(`🗑  S3 deleted: ${key}`);
  } catch (err) {
    console.error('fileStorage.deleteFile failed:', err.message);
  }
}

module.exports = { validate, store, deleteFile, ALLOWED_MIME_TYPES, MAX_FILE_BYTES };
