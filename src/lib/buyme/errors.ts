/** Errors modeled after maccabi-health transport/auth failures. */

export class BuyMeError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "BuyMeError";
    this.code = code;
  }
}

export class ReauthenticationRequired extends BuyMeError {
  constructor(detail?: string) {
    super("REAUTHENTICATION_REQUIRED", detail ?? "BuyMe session expired — reconnect");
    this.name = "ReauthenticationRequired";
  }
}

export class UpstreamError extends BuyMeError {
  readonly status?: number;
  constructor(code: string, status?: number) {
    super(code, status ? `${code} (${status})` : code);
    this.name = "UpstreamError";
    this.status = status;
  }
}
