-- Migration: Add mode, status, admin_name columns to admin_impersonation_sessions
-- for visible (consent-based) impersonation support.
-- Idempotent: Safe to run multiple times.

ALTER TABLE "admin_impersonation_sessions" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'ghost';
ALTER TABLE "admin_impersonation_sessions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "admin_impersonation_sessions" ADD COLUMN IF NOT EXISTS "admin_name" TEXT;
