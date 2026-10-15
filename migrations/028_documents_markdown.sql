-- 028: let the Documents screen (RAPTRRAPTR) accept Markdown (.md) files.
-- Only the private "rr-documents" bucket needs this change: it restricts which file types can be uploaded.
-- The "attachments" bucket has no such restriction, so .md files already attach to tasks, threads and events.
-- Safe to run more than once. No existing data is touched.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'text/markdown'
]
where id = 'rr-documents';
