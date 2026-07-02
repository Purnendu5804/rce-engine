export interface SubmissionRequest {
  language: string;
  code: string;
  stdin?: string;
}

export interface SubmissionResponse {
  id: string;
  status: "queued";
}
