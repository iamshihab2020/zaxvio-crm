import { z } from "zod";

export const idParam = z.object({
  id: z.string().uuid(),
});

/**
 * Allowed pipeline stage color keys — mirrors the frontend's STAGE_COLOR_PRESETS
 * in `apps/web/src/lib/constants/stage-color-presets.ts`. Keep in sync if new
 * presets are added. Validated here to prevent garbage values making it into
 * the DB where they'd render as no-color dots on the dashboard.
 */
export const stageColorKey = z.enum([
  "blue",
  "brand",
  "green",
  "red",
  "purple",
  "amber",
  "teal",
  "gray",
]);

// ── Pipelines ────────────────────────────────────────────────────────────────

export const createPipelineBody = z.object({
  label: z.string().min(1),
  isDefault: z.boolean().optional(),
  seedDefaultStages: z.boolean().optional(),
  copyFromPipelineId: z.string().uuid().optional(),
});

export const updatePipelineBody = z.object({
  label: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

// ── Pipeline Stages ───────────────────────────────────────────────────────────

export const pipelineStagesQuery = z.object({
  pipelineId: z.string().uuid().optional(),
});

export const createPipelineStageBody = z.object({
  label: z.string().min(1),
  color: stageColorKey.optional(),
  pipelineId: z.string().uuid(),
});

export const reorderPipelineStagesBody = z.object({
  order: z.array(z.string().uuid()).min(1),
});

export const updatePipelineStageBody = z.object({
  label: z.string().min(1).optional(),
  color: stageColorKey.optional(),
});
