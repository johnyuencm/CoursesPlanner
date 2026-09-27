"use client";

import { Fragment } from "react";
import { TriangleAlert } from "lucide-react";
import type { RequirementExpression } from "@/lib/types";
import {
  REQUIREMENT_ALL_LABEL,
  REQUIREMENT_ANY_LABEL,
  simplifyRequirement,
} from "@/lib/graph";
import { useApp } from "./app-provider";

export function RequirementTree({
  expression,
  satisfied,
  onSelect,
}: {
  expression: RequirementExpression;
  satisfied?: Iterable<string>;
  onSelect?: (code: string) => void;
}) {
  const { openCourse } = useApp();
  return <RequirementTreeView expression={expression} satisfied={satisfied} onSelect={onSelect ?? openCourse} />;
}

export function RequirementTreeView({
  expression,
  satisfied,
  onSelect,
}: {
  expression: RequirementExpression;
  satisfied?: Iterable<string>;
  onSelect: (code: string) => void;
}) {
  const done = satisfied instanceof Set ? satisfied : new Set(satisfied ?? []);
  return <RequirementNode expression={simplifyRequirement(expression)} done={done} onSelect={onSelect} />;
}

function RequirementNode({
  expression,
  done,
  onSelect,
}: {
  expression: RequirementExpression;
  done: Set<string>;
  onSelect: (code: string) => void;
}) {
  if (expression.type === "none") return <span className="muted">None listed in the catalog.</span>;
  if (expression.type === "unknown") {
    return <div className="inline-warning"><TriangleAlert size={15} /><span>Needs review — {expression.text}</span></div>;
  }
  if (expression.type === "course") {
    const met = done.has(expression.code);
    return <span className={`requirement-leaf${met ? " met" : ""}`}>
      <button className="code-chip" type="button" onClick={() => onSelect(expression.code)}>{expression.code}</button>
      {expression.minimumGrade && <small>grade ≥ {expression.minimumGrade}</small>}
      {expression.concurrent && <small>may be concurrent</small>}
      <span className="sr-only">{met ? "completed or waived" : "still needed"}</span>
    </span>;
  }
  const label = expression.type === "all" ? REQUIREMENT_ALL_LABEL : REQUIREMENT_ANY_LABEL;
  return <div className={`requirement-branch requirement-${expression.type}`}>
    <span className="rule-operator">{label}</span>
    <ul>{expression.items.map((item, index) => <li key={index}><RequirementNode expression={item} done={done} onSelect={onSelect} /></li>)}</ul>
  </div>;
}

export function RequirementChips({
  expression,
  onSelect,
}: {
  expression: RequirementExpression;
  onSelect?: (code: string) => void;
}) {
  const { openCourse } = useApp();
  return <RequirementChipsView expression={expression} onSelect={onSelect ?? openCourse} />;
}

export function RequirementChipsView({
  expression,
  onSelect,
}: {
  expression: RequirementExpression;
  onSelect: (code: string) => void;
}) {
  const tree = simplifyRequirement(expression);
  if (tree.type === "none") return <span className="muted">None</span>;
  if (tree.type === "unknown") return <span className="muted">Needs review</span>;
  return <span className="requirement-chips"><RequirementChipNode expression={tree} onSelect={onSelect} nested={false} /></span>;
}

function RequirementChipNode({
  expression,
  onSelect,
  nested,
}: {
  expression: RequirementExpression;
  onSelect: (code: string) => void;
  nested: boolean;
}) {
  if (expression.type === "none") return <span className="muted">None</span>;
  if (expression.type === "unknown") return <span className="muted">Needs review</span>;
  if (expression.type === "course") {
    return <button className="code-chip" type="button" onClick={() => onSelect(expression.code)}>{expression.code}</button>;
  }
  const joiner = expression.type === "all" ? "AND" : "OR";
  const inner = expression.items.map((item, index) => (
    <Fragment key={index}>
      {index > 0 ? <span className="rule-operator">{joiner}</span> : null}
      <RequirementChipNode expression={item} onSelect={onSelect} nested />
    </Fragment>
  ));
  return nested ? <span className="requirement-group">({inner})</span> : <>{inner}</>;
}
