"use client";

import {
  isPropertyVisible,
  type NodeDefinition,
  type NodeProperty,
  type SubjectType,
} from "@hvac-saas/workflow-nodes";
import type { BuilderContext } from "@/actions/workflows";
import {
  BooleanField,
  DateField,
  DateVariableField,
  DurationField,
  KeyValueField,
  MemberField,
  MoneyField,
  MultiOptionsField,
  NoticeField,
  NumberField,
  OptionsField,
  PipelineField,
  StageField,
  StringField,
  TextField,
  TimeField,
} from "./fields";
import {
  CatalogItemField,
  ChecklistField,
  ContractField,
  CustomerField,
  EquipmentField,
  JobField,
  MultiTagField,
  ServiceTypeField,
  TagField,
  WorkflowField,
} from "./crm-pickers";
import { NodeSelectField, VariablePathField } from "./graph-fields";
import { ConditionsField } from "./conditions-field";

/**
 * A node's form, generated from its definition.
 *
 * **The whole architecture rests on this being generated rather than written.**
 * A new node type is a definition file and one executor; if forms were
 * hand-built per node, it would also be a React component, and the definition
 * would stop being the source of truth the moment the two disagreed.
 *
 * The switch below is the only place a `NodePropertyType` becomes UI. Adding a
 * type is a case here and a component in `fields.tsx` — no node ever has to
 * know how its own fields are drawn.
 */

interface Props {
  definition: NodeDefinition;
  parameters: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
  nodeId: string;
  disabled?: boolean;
  context: BuilderContext | null;
  contextLoading: boolean;
  /** What the trigger provides — scopes the variable picker. */
  subject: SubjectType | null;
  /**
   * The automation being edited. The searchable pickers query through it, so
   * the endpoint can 404 for an automation this tenant does not own rather than
   * exposing the customer list to id-less probing.
   */
  workflowId: string;
}

export function ConfigRenderer({
  definition,
  parameters,
  onChange,
  nodeId,
  disabled,
  context,
  contextLoading,
  subject,
  workflowId,
}: Props) {
  // C-1: conditional fields are a MUST. Without them an eight-property email
  // node is an unusable wall of inputs, and the same evaluation runs in the
  // validator so a field the form is hiding never blocks a publish.
  const visible = definition.properties.filter((property) =>
    isPropertyVisible(property, parameters),
  );

  if (visible.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground font-body">
        This step has nothing to configure.
      </p>
    );
  }

  return (
    <div className="space-y-5 px-4 py-4">
      {visible.map((property, index) => (
        <div
          key={property.name}
          // Travels in from the right, because the panel it lives in opened
          // from the right. Motion that disagrees with the layout reads as a
          // glitch rather than as an arrival.
          className="animate-panel-item-right"
          style={
            { "--enter-delay": `${Math.min(index, 8) * 25}ms` } as React.CSSProperties
          }
        >
          <Field
            property={property}
            parameters={parameters}
            onChange={onChange}
            nodeId={nodeId}
            disabled={disabled}
            context={context}
            contextLoading={contextLoading}
            subject={subject}
            workflowId={workflowId}
          />
        </div>
      ))}
    </div>
  );
}

function Field({
  property,
  parameters,
  onChange,
  nodeId,
  disabled,
  context,
  contextLoading,
  subject,
  workflowId,
}: {
  property: NodeProperty;
  parameters: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
  nodeId: string;
  disabled?: boolean;
  context: BuilderContext | null;
  contextLoading: boolean;
  subject: SubjectType | null;
  workflowId: string;
}) {
  const shared = {
    property,
    value: parameters[property.name],
    onChange: (value: unknown) => onChange(property.name, value),
    disabled,
    // Siblings, so a stage picker can read the pipelineId beside it (C-4).
    siblings: parameters,
    nodeId,
    subject,
  };
  const picker = { ...shared, context, contextLoading };
  // Searchable pickers need the automation id to query through. Kept separate
  // from `picker` so a bounded picker cannot accidentally depend on it.
  const searchable = { ...picker, workflowId };

  switch (property.type) {
    // ── P5 primitives ────────────────────────────────────────────────────────
    case "string":
      return <StringField {...shared} />;
    case "text":
      return <TextField {...shared} />;
    case "number":
      return <NumberField {...shared} />;
    case "boolean":
      return <BooleanField {...shared} />;
    case "options":
      return <OptionsField {...shared} />;
    case "multiOptions":
      return <MultiOptionsField {...shared} />;
    case "date":
      return <DateField {...shared} />;
    case "dateVariable":
      return <DateVariableField {...shared} />;
    case "time":
      return <TimeField {...shared} />;
    case "duration":
      return <DurationField {...shared} />;
    case "keyValue":
      return <KeyValueField {...shared} />;
    case "notice":
      return <NoticeField {...shared} />;
    case "conditions":
      return <ConditionsField {...shared} />;

    // ── CRM pickers already referenced by shipped definitions ────────────────
    case "moneyInput":
      return <MoneyField {...shared} />;
    case "memberSelect":
      return <MemberField {...picker} />;
    case "pipelineSelect":
      return <PipelineField {...picker} />;
    case "stageSelect":
      return <StageField {...picker} />;

    // ── P7 CRM pickers ───────────────────────────────────────────────────────
    //
    // Bounded — options ship with `builder-context` on node open.
    case "tagSelect":
      return <TagField {...picker} />;
    case "multiTagSelect":
      return <MultiTagField {...picker} />;
    case "checklistSelect":
      return <ChecklistField {...picker} />;
    case "catalogItemSelect":
      return <CatalogItemField {...picker} />;
    case "serviceTypeSelect":
      return <ServiceTypeField {...picker} />;
    case "workflowSelect":
      return <WorkflowField {...picker} />;

    // Searchable — bounded by how long the business has existed, so they query.
    case "customerSelect":
      return <CustomerField {...searchable} />;
    case "jobSelect":
      return <JobField {...searchable} />;
    case "equipmentSelect":
      return <EquipmentField {...searchable} />;
    case "contractSelect":
      return <ContractField {...searchable} />;

    // ── graph-scoped: options come from the trigger or the canvas ────────────
    case "variablePath":
      return <VariablePathField {...shared} />;
    case "nodeSelect":
      return <NodeSelectField {...shared} />;

    default:
      // Named, not silent. A field with no renderer would otherwise be a gap in
      // the form the user cannot see — and they would publish an automation
      // missing a value nothing ever asked them for.
      return (
        <div className="rounded-md border border-dashed border-border px-3 py-2.5">
          <p className="text-sm font-medium font-body">{property.displayName}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground font-body">
            This kind of field isn&rsquo;t available yet, so this step can&rsquo;t be
            set up here for now.
          </p>
        </div>
      );
  }
}
