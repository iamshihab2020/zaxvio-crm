/**
 * Flat config is resolved from the working directory, so every package needs a
 * file here even when it has nothing of its own to say. Re-export, never copy —
 * three divergent rule sets is how the same defect gets caught in one package
 * and shipped from another.
 */
export { default } from "@hvac-saas/config/eslint";
