"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const messages: Record<string, string> = {
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Bạn không có quyền quản trị.",
  ACCOUNT_DISABLED: "Tài khoản đang bị vô hiệu hóa.",
  TEST_NOT_FOUND: "Không tìm thấy đề thi.",
  VERSION_NOT_FOUND: "Không tìm thấy phiên bản đề.",
  SECTION_NOT_FOUND: "Section không còn tồn tại. Hãy tải lại nội dung.",
  GROUP_NOT_FOUND: "Nhóm câu hỏi không còn tồn tại. Hãy tải lại nội dung.",
  QUESTION_NOT_FOUND: "Câu hỏi không còn tồn tại. Hãy tải lại nội dung.",
  NOT_DRAFT: "Phiên bản đã khóa chỉnh sửa. Hãy tải lại để xem trạng thái mới nhất.",
  NOT_EDITABLE: "Chỉ đổi kỹ năng khi đề chưa từng xuất bản và chưa có section.",
  TEST_ARCHIVED: "Đề đã lưu trữ và không thể xuất bản hoặc hiện lại.",
  ALREADY_ARCHIVED: "Đề đã được lưu trữ.",
  ALREADY_PUBLISHED: "Phiên bản này đã được xuất bản.",
  INVALID_STATUS_TRANSITION: "Trạng thái hiện tại không cho phép thao tác này.",
  INVALID_SETTINGS: "Cấu hình chưa hợp lệ. Kiểm tra chế độ, thời gian và số lượt.",
  INVALID_QUESTION_TYPE: "Dạng câu hỏi hoặc định dạng trả lời không phù hợp.",
  INVALID_ANSWER_KEY: "Đáp án chưa hợp lệ. Kiểm tra lựa chọn và số đáp án cần chọn.",
  ANSWER_EXCEEDS_WORD_LIMIT: "Một đáp án được chấp nhận vượt giới hạn từ.",
  VALIDATION_FAILED: "Đề còn lỗi chặn xuất bản. Kiểm tra báo cáo bên dưới.",
  VALIDATION_ERROR: "Thông tin chưa hợp lệ. Kiểm tra các trường đang nhập.",
  NETWORK_ERROR: "Không thể kết nối. Kiểm tra mạng và thử lại.",
  INTERNAL_ERROR: "Hệ thống chưa thể xử lý yêu cầu. Vui lòng thử lại.",
};

export class AdminApiError extends Error {
  constructor(public code: string, public status: number, public details: unknown = null) {
    super(messages[code] ?? "Không thể thực hiện thao tác. Vui lòng thử lại.");
    this.name = "AdminApiError";
  }
}
export function adminError(error: unknown) {
  return error instanceof Error ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
export async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminApiError("NETWORK_ERROR", 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("ielts:unauthorized"));
    throw new AdminApiError(payload?.error?.code ?? "INTERNAL_ERROR", response.status, payload?.error?.details ?? null);
  }
  if (payload === null) throw new AdminApiError("INTERNAL_ERROR", 500);
  return payload as T;
}
export function body(value: unknown): RequestInit {
  return { body: JSON.stringify(value) };
}

/** Giữ request mới nhất khi người dùng đổi bộ lọc hoặc chuyển tài nguyên. */
export function useAdminResource<T>(url: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState((current) => ({ ...current, error: null, loading: Boolean(url) }));
    if (!url) { setState({ data: null, error: null, loading: false }); return null; }
    try {
      const data = await adminApi<T>(url, { signal: controller.signal });
      if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (!controller.signal.aborted) setState({ data: null, error: adminError(error), loading: false });
      return null;
    }
  }, [url]);
  useEffect(() => {
    void refresh();
    return () => request.current?.abort();
  }, [refresh]);
  return { ...state, refresh };
}
