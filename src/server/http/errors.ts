/**
 * API error catalogue (docs/backend/api-contract.md §1.5).
 * `code` is the stable value the FE branches on; `message` is English text for
 * developers and may change.
 */
export const ERROR_STATUS = {
  // 400 — invalid input
  VALIDATION_ERROR: 400,
  INVALID_QUERY: 400,
  INVALID_ANSWER: 400,
  INVALID_ANSWER_KEY: 400,
  INVALID_QUESTION_TYPE: 400,
  INVALID_ORDER: 400,
  INVALID_SETTINGS: 400,
  INVALID_SCORE_RANGE: 400,
  OVERLAPPING_RANGE: 400,
  // 401
  UNAUTHORIZED: 401,
  // 403
  FORBIDDEN: 403,
  ACCOUNT_DISABLED: 403,
  ACCESS_DENIED: 403,
  // 404 — not found, or not yours
  TEST_NOT_FOUND: 404,
  VERSION_NOT_FOUND: 404,
  SECTION_NOT_FOUND: 404,
  GROUP_NOT_FOUND: 404,
  QUESTION_NOT_FOUND: 404,
  ANSWER_KEY_NOT_FOUND: 404,
  ATTEMPT_NOT_FOUND: 404,
  SOURCE_VERSION_NOT_FOUND: 404,
  // 409 — the resource's state forbids the request
  TEST_NOT_PUBLISHED: 409,
  TEST_ARCHIVED: 409,
  ACTIVE_ATTEMPT_EXISTS: 409,
  MAX_ATTEMPT_REACHED: 409,
  ATTEMPT_NOT_STARTED: 409,
  ATTEMPT_LOCKED: 409,
  ATTEMPT_EXPIRED: 409,
  RESULT_NOT_READY: 409,
  NOT_DRAFT: 409,
  NOT_EDITABLE: 409,
  ALREADY_PUBLISHED: 409,
  ALREADY_ARCHIVED: 409,
  INVALID_STATUS_TRANSITION: 409,
  DRAFT_VERSION_EXISTS: 409,
  // 422 — publish blocked by content validation
  VALIDATION_FAILED: 422,
  // 429
  RATE_LIMITED: 429,
  // 500
  GRADING_FAILED: 500,
  INTERNAL_ERROR: 500,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

export type ErrorDetails = Record<string, unknown>;

export type ErrorBody = {
  error: { code: ErrorCode; message: string; details: ErrorDetails | null };
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorDetails | null;

  constructor(code: ErrorCode, message: string, details: ErrorDetails | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }

  toBody(): ErrorBody {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}
