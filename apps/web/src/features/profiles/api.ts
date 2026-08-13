import {
  profileOptionsSchema,
  studentProfileSchema,
  type ProfileOptions,
  type StudentProfile,
  type UpsertStudentProfileInput,
} from "@onthilab/contracts";
import { apiRequest } from "../../api/http";

export async function getMyProfile(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<StudentProfile | null> {
  const result = await apiRequest("/v1/me", idToken, {}, fetcher);
  return studentProfileSchema.nullable().parse(result);
}

export async function getProfileOptions(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<ProfileOptions> {
  const result = await apiRequest("/v1/profile-options", idToken, {}, fetcher);
  return profileOptionsSchema.parse(result);
}

export async function saveMyProfile(
  idToken: string,
  input: UpsertStudentProfileInput,
  fetcher: typeof fetch = fetch,
): Promise<StudentProfile> {
  const result = await apiRequest(
    "/v1/me",
    idToken,
    { method: "PUT", body: JSON.stringify(input) },
    fetcher,
  );
  return studentProfileSchema.parse(result);
}
