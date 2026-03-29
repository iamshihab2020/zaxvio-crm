-- Migration: Add is_owner column to user table for owner protection
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_owner" BOOLEAN NOT NULL DEFAULT false;
