  Job Flow End-to-End Audit Report                                                                                                                                                                                                                                                                                                              Executive Summary                                                                                                                                                                                                                                                                                                                             67 issues found across 5 audit areas. 10 HIGH severity, 22 MEDIUM, 35 LOW/informational.                                                                                                                                                                                                                                                      The most critical systemic problems:                                                                                                                                   1. No database transactions in any conversion flow (quote→job, booking→job)                                                                                            2. Cross-tenant data leaks via unvalidated pipelineId and assigneeId                                                                                                   3. Priority enum mismatch between Zod schemas and DB — will crash at runtime                                                                                           4. Storage files never actually deleted due to wrong bucket name parsing                                                                                               5. Bulk operations bypass safety checks (checklist gate, activity logging)                                                                                                                                                                                                                                                                    ---                                                                                                                                                                    I. JOB API ROUTES (22 issues)                                                                                                                                        

  HIGH

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────┬───────────┐   
  │  #  │                                                    Issue                                                     │             File              │   Lines   │   
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┼───────────┤   
  │ 1   │ No state machine for status transitions — completed jobs can go back to scheduled, cancelled→completed sets  │ jobs/index.ts                 │ 672-677   │   
  │     │ completedAt without work                                                                                     │                               │           │   
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┼───────────┤   
  │ 2   │ Priority enum mismatch — Zod allows low/high, DB enum only has standard/urgent/emergency. Inserting low or   │ schemas/jobs.ts:41,83 vs      │           │   
  │     │ high will throw a Postgres error                                                                             │ enums.ts:9-13                 │           │   
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────┼───────────┤   
  │ 3   │ Bulk status update bypasses checklist gate — single-job endpoint requires all required checklist items done  │ jobs/index.ts                 │ 1898-1933 │   
  │     │ before completed, bulk endpoint skips this entirely. Also doesn't set completedAt                            │                               │           │   
  └─────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────┴───────────┘   

  MEDIUM

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────┬─────────────────────────┬──────────────────┐      
  │  #  │                                                  Issue                                                   │          File           │      Lines       │      
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────┼──────────────────┤      
  │ 4   │ itemType enum mismatch — Zod allows labor/material/other but DB also has part/service_call               │ schemas/jobs.ts:110,121 │                  │      
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────┼──────────────────┤      
  │ 5   │ Assignee not validated as org member — any user ID accepted                                              │ jobs/index.ts           │ 470-491, 538     │      
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────┼──────────────────┤      
  │ 6   │ Pipeline ownership not validated — job can reference a pipeline from another tenant                      │ jobs/index.ts           │ 454-468, 603     │      
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────┼──────────────────┤      
  │ 7   │ Archived jobs can still be modified — PATCH, status change, line items, photos all work on archived jobs │ jobs/index.ts           │ all PATCH routes │      
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────┼──────────────────┤      
  │ 8   │ Line item quantity/price in addLineItemBody are z.string().optional() with no numeric validation         │ schemas/jobs.ts         │ 107-114          │      
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────┼──────────────────┤      
  │ 9   │ Bulk status update produces no activity log entries                                                      │ jobs/index.ts           │ 1898-1933        │      
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────┼──────────────────┤      
  │ 10  │ Reorder endpoint accepts any string as status, bypassing enum                                            │ schemas/jobs.ts         │ 97-105           │      
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────┼──────────────────┤      
  │ 11  │ createJobBody.status is z.string().optional() — any string accepted                                      │ schemas/jobs.ts         │ 69               │      
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────┼──────────────────┤      
  │ 12  │ Job delete orphans storage files (photos/documents not cleaned from Supabase)                            │ jobs/index.ts           │ 789-816          │      
  └─────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────┴──────────────────┘      

  BUG (confirmed)

  ┌─────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬───────────────┬────────────────┐   
  │  #  │                                                          Issue                                                          │     File      │     Lines      │   
  ├─────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────┼────────────────┤   
  │     │ Photo/document delete uses wrong bucket — storagePath format is {tenantId}/jobs/{id}/file, code splits on / and uses    │               │ 1524-1529,     │   
  │ 13  │ pathParts[0] (tenantId) as bucket name instead of "job-attachments". Storage delete silently fails. Files are never     │ jobs/index.ts │ 1689-1692      │   
  │     │ actually deleted.                                                                                                       │               │                │   
  └─────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴───────────────┴────────────────┘   

  LOW

  ┌─────┬────────────────────────────────────────────────────────────────┬─────────────────┬──────────────────┐
  │  #  │                             Issue                              │      File       │      Lines       │
  ├─────┼────────────────────────────────────────────────────────────────┼─────────────────┼──────────────────┤
  │ 14  │ Re-fetch after create/update omits tenantId in WHERE           │ jobs/index.ts   │ 523-526, 634-638 │
  ├─────┼────────────────────────────────────────────────────────────────┼─────────────────┼──────────────────┤
  │ 15  │ Line item DELETE uses only eq(id) without tenantId             │ jobs/index.ts   │ 1079             │
  ├─────┼────────────────────────────────────────────────────────────────┼─────────────────┼──────────────────┤
  │ 16  │ Photo tag filtering done in JS, not SQL                        │ jobs/index.ts   │ 1349-1369        │
  ├─────┼────────────────────────────────────────────────────────────────┼─────────────────┼──────────────────┤
  │ 17  │ LIKE wildcards %/_ not escaped in search                       │ jobs/index.ts   │ 186-194          │
  ├─────┼────────────────────────────────────────────────────────────────┼─────────────────┼──────────────────┤
  │ 18  │ Reorder uses Promise.all without transaction — race conditions │ jobs/index.ts   │ 833-847          │
  ├─────┼────────────────────────────────────────────────────────────────┼─────────────────┼──────────────────┤
  │ 19  │ taxRate accepts any string, parseFloat("abc") → NaN            │ schemas/jobs.ts │ 69               │
  ├─────┼────────────────────────────────────────────────────────────────┼─────────────────┼──────────────────┤
  │ 20  │ Checklist catalog item lookup omits tenantId                   │ jobs/index.ts   │ 1219-1223        │
  ├─────┼────────────────────────────────────────────────────────────────┼─────────────────┼──────────────────┤
  │ 21  │ status column is text not enum — DB accepts anything           │ schema/jobs.ts  │ 48               │
  ├─────┼────────────────────────────────────────────────────────────────┼─────────────────┼──────────────────┤
  │ 22  │ Assignees endpoint has no schema declaration                   │ jobs/index.ts   │ 113-145          │
  └─────┴────────────────────────────────────────────────────────────────┴─────────────────┴──────────────────┘

  ---
  II. CUSTOMER-TO-JOB FLOW (8 issues)

  HIGH

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────┬───────┐   
  │  #  │                                                  Issue                                                   │                 File                  │ Lines │   
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────┼───────┤   
  │ 23  │ Customer deletion cascades to hard-delete ALL jobs — no pre-check, no warning. Deleting a customer       │ schema/jobs.ts:36 +                   │       │   
  │     │ silently destroys all their jobs, line items, photos, documents, activities                              │ customers/index.ts:341-343            │       │   
  └─────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────┴───────┘   

  MEDIUM

  ┌─────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────┬─────────┐  
  │  #  │                                                           Issue                                                            │        File        │  Lines  │  
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┼─────────┤  
  │ 24  │ Bulk customer delete has same cascade problem                                                                              │ customers/index.ts │ 449-452 │  
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┼─────────┤  
  │ 25  │ Booking→job race condition — no transaction or unique constraint on jobs.bookingId, two concurrent converts create         │ bookings/index.ts  │ 296-303 │  
  │     │ duplicates                                                                                                                 │                    │         │  
  └─────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────┴─────────┘  

  LOW

  ┌─────┬─────────────────────────────────────────────────────────────────────────┬───────────────────────┬─────────┐
  │  #  │                                  Issue                                  │         File          │  Lines  │
  ├─────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼─────────┤
  │ 26  │ Customer jobs tab hardcodes limit: 50, no pagination                    │ customer-jobs-tab.tsx │ 54      │
  ├─────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼─────────┤
  │ 27  │ Booking customer email match is case-sensitive — may create duplicates  │ bookings/index.ts     │ 313-319 │
  ├─────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼─────────┤
  │ 28  │ Pre-linked customerId on bookings not re-validated for tenant ownership │ bookings/index.ts     │ 307     │
  ├─────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼─────────┤
  │ 29  │ Customer picker initial fetch fires unconditionally (minor)             │ customer-picker.tsx   │ 91-100  │
  ├─────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼─────────┤
  │ 30  │ Passed: Cross-tenant customerId properly blocked on job creation        │ jobs/index.ts         │ 438-448 │
  └─────┴─────────────────────────────────────────────────────────────────────────┴───────────────────────┴─────────┘

  ---
  III. TENANT-TO-JOB FLOW (15 issues)

  HIGH

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────────────────┬───────────────┬──────────────┐
  │  #  │                                            Issue                                             │     File      │    Lines     │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────┼───────────────┼──────────────┤
  │ 31  │ Cross-tenant pipeline reference — job PATCH writes pipelineId with no tenant ownership check │ jobs/index.ts │ 573, 603-610 │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────┼───────────────┼──────────────┤
  │ 32  │ Assignee not validated — any user ID from any org accepted on create/update                  │ jobs/index.ts │ 490, 574     │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────┼───────────────┼──────────────┤
  │ 33  │ Bulk status update bypasses checklist validation (duplicate of #3)                           │ jobs/index.ts │ 1898-1933    │
  └─────┴──────────────────────────────────────────────────────────────────────────────────────────────┴───────────────┴──────────────┘

  MEDIUM

  ┌─────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────┬─────────────────┐   
  │  #  │                                                       Issue                                                       │        File        │      Lines      │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┼─────────────────┤   
  │ 34  │ Tenant init not transactional — if pipeline/stage creation fails, tenant exists without pipeline; subsequent      │ tenants/index.ts   │ 269-312         │   
  │     │ calls skip with "already exists"                                                                                  │                    │                 │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┼─────────────────┤   
  │ 35  │ Unsetting isDefault on a pipeline can leave zero default pipelines → jobs created with null pipelineId            │ pipelines/index.ts │ 286-299         │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┼─────────────────┤   
  │ 36  │ No validation that job status matches a stage in target pipeline after pipeline change                            │ jobs/index.ts      │ 573             │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┼─────────────────┤   
  │ 37  │ Reorder endpoint allows arbitrary status changes with no stage validation                                         │ jobs/index.ts      │ 822-851         │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┼─────────────────┤   
  │ 38  │ Tenant timezone never consulted for job scheduling — date filtering is timezone-unaware                           │ jobs/index.ts      │ all date        │   
  │     │                                                                                                                   │                    │ handling        │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┼─────────────────┤   
  │ 39  │ createJobBody.status accepts any string while updateJobStatusBody is enum-restricted                              │ schemas/jobs.ts    │ 68 vs 93-94     │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────┼─────────────────┤   
  │ 40  │ Bulk status update creates no activity logs and sends no notifications                                            │ jobs/index.ts      │ 1898-1933       │   
  └─────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────┴─────────────────┘   

  LOW

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┬─────────┐       
  │  #  │                                      Issue                                       │                          File                           │  Lines  │       
  ├─────┼──────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┼─────────┤       
  │ 41  │ Tenant defaultTaxRate not auto-applied to new jobs                               │ jobs/index.ts                                           │ 488     │       
  ├─────┼──────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┼─────────┤       
  │ 42  │ Duplicated pipeline seeding logic (tenants init vs pipeline-stages fallback)     │ tenants/index.ts:289 vs pipeline-stages/index.ts:41-101 │         │       
  ├─────┼──────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┼─────────┤       
  │ 43  │ assigneeId schema accepts any string, not UUID-validated                         │ schemas/jobs.ts                                         │ 74, 90  │       
  ├─────┼──────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┼─────────┤       
  │ 44  │ pipelineId FK is onDelete: "set null" but app never handles null pipelineId jobs │ schema/jobs.ts                                          │ 41-42   │       
  ├─────┼──────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┼─────────┤       
  │ 45  │ Read after pipeline update transaction without returning()                       │ pipelines/index.ts                                      │ 279-283 │       
  └─────┴──────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────┴─────────┘       

  ---
  IV. FRONTEND (20 issues)

  Stale Data (5 issues)

  ┌─────┬────────────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────┐
  │  #  │                                             Issue                                              │               File               │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────┤
  │ 46  │ Create/update/delete never calls fetchJobsForTable() — table view always stale after mutations │ jobs-page-client.tsx:546,569,593 │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────┤
  │ 47  │ handleStatusChange doesn't refresh table                                                       │ jobs-page-client.tsx:453         │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────┤
  │ 48  │ handleJobUpdate from detail sheet doesn't refresh table                                        │ jobs-page-client.tsx:481         │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────┤
  │ 49  │ Pipeline switch causes 2 redundant fetches (direct + debounced)                                │ jobs-page-client.tsx:349-404     │
  ├─────┼────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────┤
  │ 50  │ Bulk status update doesn't refresh stage counts                                                │ jobs-page-client.tsx:429-442     │
  └─────┴────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────┘

  Optimistic Update Bugs (3 issues)

  ┌─────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────┐
  │  #  │                                                    Issue                                                     │             File             │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 51  │ Kanban cross-column drag revert captures snapshot AFTER optimistic update — revert puts card in wrong column │ kanban-board.tsx:287         │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 52  │ Within-column reorder is fire-and-forget with no error handling                                              │ kanban-board.tsx:275-277     │
  ├─────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 53  │ Selection state persists across table pagination — bulk actions affect invisible rows                        │ jobs-page-client.tsx:156-166 │
  └─────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────┘

  Form Validation Gaps (4 issues)

  ┌─────┬────────────────────────────────────────────────────────────────┬───────────────────────────────────┐
  │  #  │                             Issue                              │               File                │
  ├─────┼────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
  │ 54  │ Line item quantity/price: no numeric validation on add or edit │ job-detail-line-items.tsx:90-141  │
  ├─────┼────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
  │ 55  │ Create dialog line items: same no-numeric-validation issue     │ job-create-dialog.tsx:365-379     │
  ├─────┼────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
  │ 56  │ scheduledEnd not validated against scheduledStart              │ job-create-dialog.tsx:284-315     │
  ├─────┼────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
  │ 57  │ Line item edit form: zero validation on save                   │ job-detail-line-items.tsx:125-141 │
  └─────┴────────────────────────────────────────────────────────────────┴───────────────────────────────────┘

  Empty/Loading State Issues (4 issues)

  ┌─────┬─────────────────────────────────────────────────────────────────────────┬──────────────────────────────┐
  │  #  │                                  Issue                                  │             File             │
  ├─────┼─────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 58  │ Board with 0 stages: completely blank, no guidance                      │ jobs-page-client.tsx:734-758 │
  ├─────┼─────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 59  │ Pipeline tabs with 0 pipelines: returns null                            │ pipeline-tabs.tsx:37         │
  ├─────┼─────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 60  │ loading starts true when server prefetches 0 jobs — false loading state │ jobs-page-client.tsx:121     │
  ├─────┼─────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
  │ 61  │ No loading state for KanbanBoard dynamic import chunk                   │ jobs-page-client.tsx:9-14    │
  └─────┴─────────────────────────────────────────────────────────────────────────┴──────────────────────────────┘

  Other Frontend Issues (4 issues)

  ┌─────┬────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┐
  │  #  │                                   Issue                                    │                     File                     │
  ├─────┼────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ 62  │ Detail sheet: job deleted by another user → shows stale data forever       │ job-detail-sheet.tsx:139-143                 │
  ├─────┼────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ 63  │ Line item delete has no confirmation dialog                                │ job-detail-line-items.tsx:143-149            │
  ├─────┼────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ 64  │ Timezone inconsistency: kanban card uses local time, table uses UTC        │ kanban-card.tsx:63-66 vs job-table.tsx:55-62 │
  ├─────┼────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ 65  │ localStorage access in useState initializers causes SSR hydration mismatch │ jobs-page-client.tsx:111-148                 │
  └─────┴────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┘

  ---
  V. CONVERSION FLOWS (Quote→Job, Booking→Job, Invoice) (8 issues)

  HIGH

  ┌─────┬───────────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┬───────────┐   
  │  #  │                                             Issue                                             │                     File                     │   Lines   │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────┤   
  │ 66  │ Service type hardcoded to "repair" in quote-to-job — every converted job gets wrong service   │ quote-to-job.ts                              │ 105       │   
  │     │ type                                                                                          │                                              │           │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────┤   
  │ 67  │ No job activity logged for quote-to-job conversion — job timeline is empty                    │ quote-to-job.ts                              │ (missing) │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────┤   
  │ 68  │ Customer scheduled date/time lost during manual quote→job convert — only preserved during     │ quote-to-job.ts:90 +                         │           │   
  │     │ auto-convert                                                                                  │ quotes/index.ts:1281-1284                    │           │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────┤   
  │ 69  │ No transaction in any conversion flow — concurrent requests create duplicate jobs             │ quote-to-job.ts, bookings/index.ts           │           │   
  └─────┴───────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┴───────────┘   

  MEDIUM

  ┌─────┬───────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────┬─────────┐   
  │  #  │                                                 Issue                                                 │                  File                  │  Lines  │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────┼─────────┤   
  │ 70  │ Discount amount calculated but not persisted (jobs table has no discountAmount column) — lost on line │ quote-to-job.ts                        │ 137-152 │   
  │     │  item recalculation                                                                                   │                                        │         │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────┼─────────┤   
  │ 71  │ No duplicate invoice prevention when generating from same job                                         │ invoices/index.ts                      │ 338-445 │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────┼─────────┤   
  │ 72  │ Pipeline stage default casing mismatch: "Scheduled" (quote) vs "scheduled" (booking)                  │ quote-to-job.ts:64 vs                  │         │   
  │     │                                                                                                       │ bookings/index.ts:365                  │         │   
  ├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────┼─────────┤   
  │ 73  │ Dead code: duplicate attachChecklistToJob in quotes route                                             │ quotes/index.ts                        │ 137-188 │   
  └─────┴───────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────┴─────────┘   

  ---
  Top 10 Fixes to Prioritize

  1. Fix priority enum mismatch (#2) — this crashes at runtime
  2. Fix storage delete bucket name (#13) — photos never actually deleted
  3. Fix service type hardcode in quote-to-job (#66) — every converted job is wrong
  4. Add pipeline/assignee tenant validation (#6, #5, #31, #32) — cross-tenant data leak
  5. Wrap conversion flows in transactions (#69) — duplicate job prevention
  6. Fix kanban revert snapshot (#51) — cards land in wrong column on error
  7. Add checklist gate to bulk status update (#3) — safety bypass
  8. Block customer delete when jobs exist (#23) — silent data destruction
  9. Add table view refresh to all mutations (#46-48) — stale data in table view
  10. Fix createJobBody.status to use enum (#11, #39) — arbitrary strings in DB