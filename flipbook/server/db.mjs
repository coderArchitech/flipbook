import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
export const dataDir = resolve(process.env.DATA_DIR || "./data");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
for (const dir of ["assets", "fonts", "exports", "backups"])
  mkdirSync(resolve(dataDir, dir), { recursive: true, mode: 0o700 });
export const db = new DatabaseSync(resolve(dataDir, "flipbook.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;",
);
db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS publications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),slug TEXT UNIQUE NOT NULL,title TEXT NOT NULL,document TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,state TEXT NOT NULL DEFAULT 'active',live_version TEXT,generation INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS publication_owner ON publications(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL REFERENCES publications(id),document TEXT NOT NULL,revision INTEGER NOT NULL,generation INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'building',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,path TEXT NOT NULL,original_path TEXT NOT NULL,mime TEXT NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,bytes INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),content TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),publication_id TEXT NOT NULL REFERENCES publications(id),version_id TEXT NOT NULL REFERENCES versions(id),kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',stage TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,lease TEXT,lease_until INTEGER,run_at INTEGER NOT NULL DEFAULT 0,error TEXT,path TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status,run_at,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS unique_job ON jobs(version_id,kind);
CREATE TABLE IF NOT EXISTS idempotency(user_id TEXT NOT NULL,scope TEXT NOT NULL,key TEXT NOT NULL,hash TEXT NOT NULL,response TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,scope,key));
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL REFERENCES publications(id),version_id TEXT NOT NULL REFERENCES versions(id),session_id TEXT NOT NULL,type TEXT NOT NULL,page_id TEXT,block_id TEXT,active_ms INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_publication_date ON events(publication_id,created_at);
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL REFERENCES publications(id),reason TEXT NOT NULL,created_at TEXT NOT NULL);
INSERT OR IGNORE INTO schema_migrations VALUES(1,datetime('now'));
`);
// Additive editor migration. Existing drafts/versions are never rewritten.
db.exec(`
CREATE TABLE IF NOT EXISTS draft_revisions(publication_id TEXT NOT NULL REFERENCES publications(id),revision INTEGER NOT NULL,document TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(publication_id,revision));
CREATE TABLE IF NOT EXISTS design_resources(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,name TEXT NOT NULL,content TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS resource_owner ON design_resources(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS review_comments(id TEXT PRIMARY KEY,publication_id TEXT NOT NULL REFERENCES publications(id),page_id TEXT NOT NULL,block_id TEXT,author_id TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL,resolved INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS comments_publication ON review_comments(publication_id,created_at DESC);
CREATE TABLE IF NOT EXISTS review_approvals(publication_id TEXT PRIMARY KEY REFERENCES publications(id),revision INTEGER NOT NULL,approved_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
INSERT OR IGNORE INTO draft_revisions SELECT id,revision,document,'Existing draft',updated_at FROM publications WHERE state!='deleted';
CREATE TRIGGER IF NOT EXISTS draft_created AFTER INSERT ON publications BEGIN
 INSERT OR IGNORE INTO draft_revisions VALUES(NEW.id,NEW.revision,NEW.document,'Created',NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS draft_saved AFTER UPDATE OF document ON publications BEGIN
 INSERT OR IGNORE INTO draft_revisions VALUES(OLD.id,OLD.revision,OLD.document,'Saved',OLD.updated_at);
 INSERT OR IGNORE INTO draft_revisions VALUES(NEW.id,NEW.revision,NEW.document,'Saved',NEW.updated_at);
 DELETE FROM draft_revisions WHERE publication_id=NEW.id AND revision NOT IN (SELECT revision FROM draft_revisions WHERE publication_id=NEW.id ORDER BY revision DESC LIMIT 100);
END;
INSERT OR IGNORE INTO schema_migrations VALUES(2,datetime('now'));
`);
// Additive font migration: uploaded fonts are immutable owner-scoped files.
db.exec(`
CREATE TABLE IF NOT EXISTS fonts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),family TEXT NOT NULL,name TEXT NOT NULL,path TEXT NOT NULL,format TEXT NOT NULL,bytes INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS font_owner ON fonts(user_id,created_at DESC);
INSERT OR IGNORE INTO schema_migrations VALUES(3,datetime('now'));
`);
export const get = (sql, ...args) => db.prepare(sql).get(...args);
export const all = (sql, ...args) => db.prepare(sql).all(...args);
export const run = (sql, ...args) => db.prepare(sql).run(...args);
export function tx(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export const now = () => new Date().toISOString();
