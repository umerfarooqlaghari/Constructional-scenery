/**
 * FileStorageService — shared file upload/delete service.
 *
 * Currently uses local disk storage via Multer.
 * To switch to AWS S3: set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 * AWS_REGION in your environment and uncomment the S3 methods below.
 */

const path = require('path');
const fs   = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_FILE_BYTES      = 25 * 1024 * 1024; // 25 MB

/** Validate MIME type and size. Throws if invalid. */
function validate(mimetype, size) {
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    throw Object.assign(
      new Error(`File type "${mimetype}" is not allowed. Accepted types: PDF, JPEG, PNG.`),
      { status: 400 }
    );
  }
  if (size > MAX_FILE_BYTES) {
    throw Object.assign(
      new Error(`File is too large. Maximum size is 25 MB.`),
      { status: 400 }
    );
  }
}

/**
 * Store a multer file object.
 * Returns { url, key, size }.
 * `key` is used to delete the file later.
 */
function store(multerFile) {
  // S3 path (future): uncomment below and remove local path
  // if (process.env.AWS_S3_BUCKET) return _storeS3(multerFile);
  return _storeLocal(multerFile);
}

function _storeLocal(multerFile) {
  const url = `/uploads/${multerFile.filename}`;
  return { url, key: multerFile.filename, size: multerFile.size };
}

/**
 * Delete a stored file by its key.
 */
async function deleteFile(key) {
  // S3 path (future): if (process.env.AWS_S3_BUCKET) return _deleteS3(key);
  _deleteLocal(key);
}

function _deleteLocal(key) {
  if (!key) return;
  const filePath = path.join(UPLOAD_DIR, key);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error('fileStorage._deleteLocal failed:', err.message);
  }
}

/* ── S3 stub (activate when AWS creds are available) ──────────────────────
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'eu-west-2' });

async function _storeS3(multerFile) {
  const key = `uploads/${Date.now()}-${multerFile.originalname}`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: fs.createReadStream(multerFile.path),
    ContentType: multerFile.mimetype,
  }));
  fs.unlinkSync(multerFile.path); // remove temp file
  const url = `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
  return { url, key, size: multerFile.size };
}

async function _deleteS3(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key }));
}
──────────────────────────────────────────────────────────────────────── */

module.exports = { validate, store, deleteFile, ALLOWED_MIME_TYPES, MAX_FILE_BYTES };
