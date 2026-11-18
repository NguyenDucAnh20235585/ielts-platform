import { rulesInputSchema } from "./schemas";

/** Effective rules of one question after merging group rules and question config. */
export type Rules = {
  maxWords: number | null;
  allowNumber: boolean;
  selectCount: number | null;
  allowOptionReuse: boolean;
};

/**
 * `question.config` overrides `group.rules` key by key (api-contract §2.2).
 * A key that is absent inherits; an explicit `null` clears the group value.
 * Throws if stored JSON does not match the schema (it is validated on write).
 */
export function resolveRules(groupRules: unknown, questionConfig: unknown): Rules {
  const group = rulesInputSchema.parse(groupRules ?? {});
  const question = rulesInputSchema.parse(questionConfig ?? {});
  return {
    maxWords: override(question.max_words, group.max_words) ?? null,
    allowNumber: override(question.allow_number, group.allow_number) ?? false,
    selectCount: override(question.select_count, group.select_count) ?? null,
    allowOptionReuse: override(question.allow_option_reuse, group.allow_option_reuse) ?? false,
  };
}

function override<Value>(questionValue: Value | undefined, groupValue: Value | undefined) {
  return questionValue !== undefined ? questionValue : groupValue;
}
