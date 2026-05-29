/**
 * Multer upload middleware — temporary local disk storage.
 *
 * Files are saved to  backend/uploads/<timestamp>-<random>-<originalname>
 * Served statically at  GET /uploads/<filename>
 *
 * Replace with cloud storage (Cloudflare R2 / AWS S3) when ready.
 * Just swap the multer storage engine and the file_url base URL.
 */

const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// Ensure uploads directory exists at startup
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext    = path.extname(file.originalname).toLowerCase();
    const base   = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9_-]/gi, '_')   // sanitise filename
      .slice(0, 80);
    cb(null, `${unique}-${base}${ext}`);
  },
});

const ALLOWED_EXTS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif',
  '.doc', '.docx', '.xls', '.xlsx', '.csv',
  '.zip', '.txt',
]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.has(ext)) cb(null, true);
  else cb(new Error(`File type "${ext}" is not allowed`));
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },  // 20 MB max
  fileFilter,
});

/**
 * Build the publicly accessible URL for an uploaded file.
 * e.g.  http://localhost:5000/uploads/16000000-123-myfile.pdf
 */
const fileUrl = (filename) =>
  `${process.env.APP_URL || 'http://localhost:5000'}/uploads/${filename}`;

module.exports = { upload, fileUrl };
