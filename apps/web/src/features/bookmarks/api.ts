import {
  bookmarkCollectionSchema,
  bookmarkStateSchema,
  type BookmarkCollection,
} from "@onthilab/contracts";
import { apiRequest } from "../../api/http";

export async function getBookmarks(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<BookmarkCollection> {
  const result = await apiRequest("/v1/bookmarks", idToken, {}, fetcher);
  return bookmarkCollectionSchema.parse(result);
}

export async function setExamBookmark(
  idToken: string,
  examId: string,
  bookmarked: boolean,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const result = await apiRequest(
    `/v1/bookmarks/exams/${encodeURIComponent(examId)}`,
    idToken,
    { method: bookmarked ? "PUT" : "DELETE" },
    fetcher,
  );
  return bookmarkStateSchema.parse(result).bookmarked;
}

export async function setQuestionBookmark(
  idToken: string,
  questionId: string,
  bookmarked: boolean,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const result = await apiRequest(
    `/v1/bookmarks/questions/${encodeURIComponent(questionId)}`,
    idToken,
    { method: bookmarked ? "PUT" : "DELETE" },
    fetcher,
  );
  return bookmarkStateSchema.parse(result).bookmarked;
}
