-- Add sort_order column to jobs table for kanban card reordering
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
