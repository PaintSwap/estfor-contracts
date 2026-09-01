export type ReconciliationAction = "add" | "update" | "remove";

export interface ReconciliationOperation<Resource extends string = string, Postcondition = unknown> {
  id: string;
  domain: string;
  action: ReconciliationAction;
  resource: Resource;
  target: string;
  caller: string;
  value: string;
  data: string;
  destructive: boolean;
  dependencies: string[];
  estimatedGas: string | null;
  postcondition: Postcondition;
}

export interface ReconciliationPlan<Desired, Current, Changes, Limits, Operation extends ReconciliationOperation> {
  policy: "exact" | "additive";
  desired: Desired;
  current: Current;
  changes: Changes;
  limits: Limits;
  blockedReasons: string[];
  operations: Operation[];
}

export interface ReconciliationPlanOptions {
  allowRemovals?: boolean;
  maxChangedItems?: number;
  maxRemovals?: number;
}
