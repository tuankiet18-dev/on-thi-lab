import type { OcrQuestionStatus } from "@onthilab/contracts";
import { ApiError, ApiResponseValidationError } from "../../api/http";

export type ReviewFilter = "attention" | "all" | "text" | "image";

export const ocrStatusLabel: Record<OcrQuestionStatus["ocrStatus"], string> = {
  pending: "Chờ OCR",
  processing: "Đang OCR",
  approved: "Đã duyệt",
  needs_review: "Cần kiểm tra",
  failed: "Lỗi OCR",
};

export const ocrFlagLabel: Record<string, string> = {
  low_confidence: "Độ tin cậy OCR thấp",
  has_formula: "Có công thức hoặc ký hiệu đặc biệt",
  has_table: "Có bảng hoặc bố cục phức tạp",
  has_code_block: "Có khối mã hoặc định dạng đặc biệt",
  low_resolution: "Ảnh có độ phân giải thấp",
  missing_option_labels: "Không nhận diện đủ nhãn lựa chọn A–F",
  invalid_option_count: "Số lựa chọn không hợp lệ",
  answer_out_of_range: "Đáp án đã lưu không khớp số lựa chọn OCR",
  too_short: "Nội dung OCR quá ngắn",
  possible_graph_or_diagram: "Có thể chứa biểu đồ, hình hoặc sơ đồ",
  admin_marked_unsupported: "Đã chọn dùng ảnh gốc",
};

export function ocrLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiResponseValidationError) {
    return "Dữ liệu OCR của một hoặc nhiều câu chưa hợp lệ. Hệ thống đã dừng tự làm mới để tránh treo trang.";
  }
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Phiên đăng nhập đã hết hạn hoặc bạn không có quyền duyệt OCR.";
    }
    if (error.status === 404) return "Không tìm thấy dữ liệu OCR của đề này.";
    if (error.status >= 500) {
      return "Máy chủ OCR đang gặp sự cố tạm thời. Hãy thử lại sau.";
    }
  }
  return "Không tải được dữ liệu OCR. Hãy thử lại.";
}

export function ocrStatusTone(status: OcrQuestionStatus["ocrStatus"]) {
  if (status === "approved") return "green" as const;
  if (status === "needs_review") return "amber" as const;
  if (status === "failed") return "pink" as const;
  return "slate" as const;
}
