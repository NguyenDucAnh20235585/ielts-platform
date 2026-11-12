const messages: Record<string, string> = {
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  ACCOUNT_DISABLED: "Tài khoản đang bị vô hiệu hóa. Vui lòng liên hệ người quản trị.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  ACCESS_DENIED: "Bạn không có quyền truy cập bài này.",
  TEST_NOT_FOUND: "Không tìm thấy đề hoặc đề không còn khả dụng.",
  TEST_NOT_PUBLISHED: "Đề này hiện chưa được mở để làm bài.",
  ATTEMPT_NOT_FOUND: "Không tìm thấy lần làm bài của bạn.",
  ACTIVE_ATTEMPT_EXISTS: "Bạn đã có một lần làm bài chưa hoàn tất cho đề này.",
  MODE_NOT_AVAILABLE: "Chế độ này hiện không khả dụng.",
  MAX_ATTEMPT_REACHED: "Bạn đã sử dụng hết lượt làm bài trong chế độ này.",
  ATTEMPT_NOT_STARTED: "Hãy bắt đầu bài trước khi thực hiện thao tác này.",
  ATTEMPT_LOCKED: "Bài đã kết thúc và không thể chỉnh sửa.",
  ATTEMPT_EXPIRED: "Đã hết thời gian làm bài.",
  RESULT_NOT_READY: "Kết quả chưa sẵn sàng. Vui lòng thử lại.",
  INVALID_ANSWER: "Một câu trả lời chưa hợp lệ. Vui lòng kiểm tra lại.",
  VALIDATION_ERROR: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Hãy chờ một chút rồi thử lại.",
  GRADING_FAILED: "Chưa thể chấm bài. Bài chưa được nộp, bạn có thể thử lại.",
  NETWORK_ERROR: "Không thể kết nối. Kiểm tra mạng và thử lại.",
  INTERNAL_ERROR: "Hệ thống chưa thể xử lý yêu cầu. Vui lòng thử lại.",
};
export class StudentApiError extends Error {
  constructor(public code: string, public status: number, public details: Record<string, unknown> | null = null) {
    super(messages[code] ?? "Không thể thực hiện thao tác. Vui lòng thử lại.");
    this.name = "StudentApiError";
  }
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
export async function studentApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  try {
    response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new StudentApiError("NETWORK_ERROR", 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("ielts:unauthorized"));
    throw new StudentApiError(payload?.error?.code ?? "INTERNAL_ERROR", response.status, payload?.error?.details ?? null);
  }
  if (payload === null) throw new StudentApiError("INTERNAL_ERROR", 500);
  return payload as T;
}
export const jsonBody = (value: unknown) => JSON.stringify(value);
