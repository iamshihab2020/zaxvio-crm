import { z } from "zod";

export const idParam = z.object({
  id: z.string().uuid(),
});

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
  color: z.string().optional(),
  pipelineId: z.string().uuid(),
});

export const reorderPipelineStagesBody = z.object({
  order: z.array(z.string().uuid()).min(1),
});

export const updatePipelineStageBody = z.object({
  label: z.string().min(1).optional(),
  color: z.string().optional(),
});
