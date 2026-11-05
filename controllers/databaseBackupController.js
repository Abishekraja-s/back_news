import { createReadStream, createWriteStream } from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { pipeline } from 'stream/promises';

const SENSITIVE_USER_FIELDS = new Set([
  'password',
  'refreshToken',
  'passwordResetToken',
  'passwordResetExpires',
]);

/** @type {Map<string, object>} */
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;

const isObjectIdLike = (val) =>
  val &&
  typeof val === 'object' &&
  (val._bsontype === 'ObjectID' ||
    val._bsontype === 'ObjectId' ||
    val.constructor?.name === 'ObjectId');

const isBinaryLike = (val) => {
  if (!val) return false;
  if (Buffer.isBuffer(val)) return true;
  if (val._bsontype === 'Binary' || val.constructor?.name === 'Binary') return true;
  if (val.type === 'Buffer' && Array.isArray(val.data)) return true;
  return false;
};

const serializeDoc = (doc, collectionName) => {
  const walk = (value, key = '') => {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (value instanceof Date) return value.toISOString();
    if (isObjectIdLike(value)) return String(value);
    if (isBinaryLike(value)) {
      const size = Buffer.isBuffer(value)
        ? value.length
        : value.length || value.data?.length || 0;
      return `[Binary omitted: ${size} bytes]`;
    }
    if (typeof value === 'object') {
      const bt = value._bsontype || value.constructor?.name;
      if (bt === 'Decimal128' || bt === 'Long' || bt === 'Double' || bt === 'Int32') {
        return value.toString?.() ?? String(value);
      }
      if (bt === 'Timestamp') return { t: value.t, i: value.i };
      if (value instanceof RegExp) {
        return { $regex: value.source, $options: value.flags };
      }
    }
    if (Array.isArray(value)) return value.map((v) => walk(v));
    if (typeof value === 'object') {
      if (/^users$/i.test(collectionName) && SENSITIVE_USER_FIELDS.has(key)) {
        return '[REDACTED]';
      }
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        try {
          if (/^users$/i.test(collectionName) && SENSITIVE_USER_FIELDS.has(k)) {
            out[k] = '[REDACTED]';
          } else {
            out[k] = walk(v, k);
          }
        } catch {
          out[k] = null;
        }
      }
      return out;
    }
    try {
      return String(value);
    } catch {
      return null;
    }
  };
  return walk(doc);
};

const listCollectionNames = async (db) => {
  const cols = await db.listCollections({}, { nameOnly: true }).toArray();
  return cols
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort((a, b) => a.localeCompare(b));
};

const writeToFile = (stream, chunk) =>
  new Promise((resolve, reject) => {
    const ok = stream.write(chunk);
    if (ok) return resolve();
    stream.once('drain', resolve);
    stream.once('error', reject);
  });

const closeStream = (stream) =>
  new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.once('error', reject);
  });

const cleanupJob = async (job) => {
  if (!job) return;
  jobs.delete(job.id);
  if (job.dir) {
    await fsp.rm(job.dir, { recursive: true, force: true }).catch(() => {});
  }
};

const scheduleJobCleanup = (jobId) => {
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) cleanupJob(job);
  }, JOB_TTL_MS);
};

const resolveCollectionNames = async (db, collectionsQuery) => {
  let names = await listCollectionNames(db);
  const only = String(collectionsQuery || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (only.length) {
    names = names.filter((n) => only.includes(n));
  }
  return names;
};

const buildDumpFile = async ({ db, names, format, meta, filePath, onProgress }) => {
  const out = createWriteStream(filePath, { encoding: 'utf8', highWaterMark: 256 * 1024 });
  let docsWritten = 0;

  try {
    if (format === 'ndjson') {
      await writeToFile(out, `${JSON.stringify({ type: 'meta', ...meta })}\n`);
      for (const name of names) {
        onProgress?.({ collection: name, docsWritten });
        const cursor = db.collection(name).find({}).batchSize(50);
        for await (const raw of cursor) {
          try {
            const doc = serializeDoc(raw, name);
            await writeToFile(
              out,
              `${JSON.stringify({ type: 'doc', collection: name, doc })}\n`
            );
          } catch (docErr) {
            await writeToFile(
              out,
              `${JSON.stringify({
                type: 'doc',
                collection: name,
                doc: { _error: String(docErr.message || docErr), _id: String(raw?._id || '') },
              })}\n`
            );
          }
          docsWritten += 1;
          if (docsWritten % 200 === 0) onProgress?.({ collection: name, docsWritten });
        }
      }
    } else {
      const pretty = format === 'pretty-json';
      const nl = pretty ? '\n' : '';
      const sp = pretty ? '  ' : '';

      await writeToFile(
        out,
        `{${nl}${sp}"meta":${JSON.stringify(meta)}${pretty ? ',\n' : ','}${sp}"collections":{`
      );

      for (let i = 0; i < names.length; i += 1) {
        const name = names[i];
        onProgress?.({ collection: name, docsWritten, collectionIndex: i + 1 });
        if (i > 0) await writeToFile(out, ',');
        await writeToFile(out, `${nl}${sp}${sp}${JSON.stringify(name)}:[`);

        const cursor = db.collection(name).find({}).batchSize(50);
        let first = true;
        for await (const raw of cursor) {
          let piece;
          try {
            piece = JSON.stringify(serializeDoc(raw, name));
          } catch (docErr) {
            piece = JSON.stringify({
              _error: String(docErr.message || docErr),
              _id: String(raw?._id || ''),
            });
          }
          if (!first) await writeToFile(out, ',');
          first = false;
          await writeToFile(out, piece);
          docsWritten += 1;
          if (docsWritten % 200 === 0) {
            onProgress?.({ collection: name, docsWritten, collectionIndex: i + 1 });
          }
        }
        await writeToFile(out, ']');
      }
      await writeToFile(out, `${nl}${sp}}${nl}}`);
    }

    await closeStream(out);
    return docsWritten;
  } catch (err) {
    out.destroy();
    throw err;
  }
};

const runBackupJob = async (job) => {
  try {
    job.status = 'building';
    job.message = 'Exporting collections…';

    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }

    const db = mongoose.connection.db;
    const names = await resolveCollectionNames(db, job.collections);
    if (!names.length) throw new Error('No matching collections');

    job.collectionCount = names.length;
    job.message = `Exporting ${names.length} collections…`;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext =
      job.format === 'ndjson' ? 'ndjson' : job.format === 'pretty-json' ? 'pretty.json' : 'json';
    const filename = `${db.databaseName}-backup-${stamp}.${ext}`;
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'gin-backup-'));
    const filePath = path.join(dir, filename);

    job.dir = dir;
    job.filePath = filePath;
    job.filename = filename;

    const meta = {
      database: db.databaseName,
      exportedAt: new Date().toISOString(),
      exportedBy: job.userId,
      exportedByEmail: job.userEmail,
      format: job.format,
      collectionCount: names.length,
      note: 'User password/refresh fields are redacted. Binary fields are omitted. Store this file securely.',
    };

    console.log(
      `[DatabaseBackup] Job ${job.id} building ${filename} (${names.length} collections)…`
    );
    const t0 = Date.now();

    const docsWritten = await buildDumpFile({
      db,
      names,
      format: job.format,
      meta,
      filePath,
      onProgress: ({ collection, docsWritten: n, collectionIndex }) => {
        job.docsWritten = n;
        job.currentCollection = collection;
        job.message = collectionIndex
          ? `Writing ${collection} (${collectionIndex}/${names.length}) — ${n} docs`
          : `Writing ${collection} — ${n} docs`;
      },
    });

    const stat = await fsp.stat(filePath);
    job.size = stat.size;
    job.docsWritten = docsWritten;
    job.status = 'ready';
    job.message = 'Backup ready';
    console.log(
      `[DatabaseBackup] Job ${job.id} ready — ${(stat.size / (1024 * 1024)).toFixed(2)} MB, ${docsWritten} docs in ${((Date.now() - t0) / 1000).toFixed(1)}s`
    );
    scheduleJobCleanup(job.id);
  } catch (err) {
    job.status = 'error';
    job.message = err.message || 'Backup failed';
    console.error(`[DatabaseBackup] Job ${job.id} error:`, err.message);
    scheduleJobCleanup(job.id);
  }
};

/** Collection list + document counts for the admin UI */
export const getBackupStats = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    const db = mongoose.connection.db;
    const names = await listCollectionNames(db);
    const collections = [];
    let totalDocuments = 0;

    for (const name of names) {
      const count = await db.collection(name).countDocuments();
      totalDocuments += count;
      collections.push({ name, count });
    }

    res.json({
      success: true,
      data: {
        database: db.databaseName,
        collectionCount: collections.length,
        totalDocuments,
        collections,
        formats: ['json', 'ndjson', 'pretty-json'],
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start a backup job (builds file on disk). Returns immediately with jobId.
 * Body/query: format, collections
 */
export const createBackupJob = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }

    const format = String(req.body?.format || req.query.format || 'json').toLowerCase();
    if (!['json', 'ndjson', 'pretty-json'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Use json, pretty-json, or ndjson',
      });
    }

    const collections = String(req.body?.collections || req.query.collections || '');
    const id = crypto.randomBytes(16).toString('hex');
    const downloadToken = crypto.randomBytes(24).toString('hex');

    const job = {
      id,
      downloadToken,
      status: 'queued',
      message: 'Queued',
      format,
      collections,
      userId: req.user?._id ? String(req.user._id) : undefined,
      userEmail: req.user?.email || undefined,
      createdAt: Date.now(),
      docsWritten: 0,
      size: 0,
      filename: null,
      filePath: null,
      dir: null,
      currentCollection: null,
      collectionCount: 0,
    };

    jobs.set(id, job);
    // Fire-and-forget build
    setImmediate(() => runBackupJob(job));

    res.status(202).json({
      success: true,
      data: {
        jobId: id,
        status: job.status,
        message: job.message,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Poll job status */
export const getBackupJob = async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Backup job not found or expired' });
  }

  res.json({
    success: true,
    data: {
      jobId: job.id,
      status: job.status,
      message: job.message,
      format: job.format,
      filename: job.filename,
      size: job.size,
      docsWritten: job.docsWritten,
      currentCollection: job.currentCollection,
      collectionCount: job.collectionCount,
      downloadToken: job.status === 'ready' ? job.downloadToken : undefined,
    },
  });
};

/**
 * Download finished backup file (direct browser download — no JS blob buffering).
 * Auth: Bearer OR ?token=downloadToken
 */
export const downloadBackupJobFile = async (req, res, next) => {
  try {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Backup job not found or expired' });
    }

    const token = String(req.query.token || '');
    const authed =
      (token && token === job.downloadToken) ||
      (req.user && String(req.user._id) === String(job.userId));

    if (!authed) {
      return res.status(401).json({ success: false, message: 'Invalid or missing download token' });
    }

    if (job.status !== 'ready' || !job.filePath) {
      return res.status(409).json({
        success: false,
        message: job.status === 'error' ? job.message : 'Backup not ready yet',
      });
    }

    const stat = await fsp.stat(job.filePath);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
    res.setHeader(
      'Content-Type',
      job.format === 'ndjson'
        ? 'application/x-ndjson; charset=utf-8'
        : 'application/json; charset=utf-8'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    res.setHeader('Content-Length', String(stat.size));

    req.setTimeout?.(0);
    res.setTimeout?.(0);

    await pipeline(createReadStream(job.filePath), res);

    // Clean up shortly after successful download
    setTimeout(() => cleanupJob(job), 60_000);
  } catch (error) {
    if (!res.headersSent) return next(error);
    console.error('[DatabaseBackup] file send error:', error.message);
    try {
      if (!res.writableEnded) res.end();
    } catch {
      /* ignore */
    }
  }
};

/**
 * Legacy one-shot stream (kept for compatibility). Prefer createBackupJob for full dumps.
 */
export const downloadBackup = async (req, res, next) => {
  // Redirect large full dumps to job flow by creating a job is client-side now.
  // Keep a small direct stream for backwards compatibility.
  return createBackupJob(req, res, next);
};
