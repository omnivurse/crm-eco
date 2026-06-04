-- Adds the status index that 202605080006_unbuilt_features_promotion.sql
-- intended for sent_emails_log. The original used the name idx_sent_emails_status,
-- which already existed on the unrelated sent_emails (singular) table from
-- 202602070006_email_system_settings.sql, so the IF NOT EXISTS guard skipped it.
CREATE INDEX IF NOT EXISTS idx_sent_emails_log_status ON sent_emails_log(status);
