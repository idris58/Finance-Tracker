const GOOGLE_GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const PROFILE_SCOPES = "openid email";
const BACKUP_PREFIX = "finance-backup-";
const RETENTION_COUNT = 2;

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GooglePromptError = {
  type?: "popup_failed_to_open" | "popup_closed" | "unknown";
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleOauth2 = {
  initTokenClient: (options: {
    client_id: string;
    scope: string;
    hint?: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: GooglePromptError) => void;
  }) => GoogleTokenClient;
};

type GoogleAccounts = {
  oauth2: GoogleOauth2;
};

type GoogleWindow = Window & {
  google?: {
    accounts?: GoogleAccounts;
  };
};

export type CloudBackupFileMeta = {
  id: string;
  name: string;
  createdTime: string;
};

let gisLoader: Promise<void> | null = null;
let tokenClient: GoogleTokenClient | null = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;
let accountHint: string | null = null;

// Shared resolve/reject for the current token request (swapped per-call)
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((error: Error) => void) | null = null;

const getClientId = () => import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const mapPromptError = (error?: GooglePromptError) => {
  if (error?.type === "popup_failed_to_open") {
    return "Google sign-in popup was blocked. Allow popups for this site and try again.";
  }
  if (error?.type === "popup_closed") {
    return "Google sign-in was closed before it finished.";
  }
  return "Google sign-in failed.";
};

const ensureGisLoaded = async () => {
  const googleWindow = window as GoogleWindow;
  if (googleWindow.google?.accounts?.oauth2) return;
  if (gisLoader) return gisLoader;

  gisLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_GIS_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity script."));
    document.head.appendChild(script);
  });

  return gisLoader;
};

const ensureTokenClient = async () => {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("Google Client ID is missing. Add VITE_GOOGLE_CLIENT_ID in your environment.");
  }

  await ensureGisLoaded();
  const googleWindow = window as GoogleWindow;
  const oauth2 = googleWindow.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error("Google Identity API is unavailable.");
  }

  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: `${DRIVE_SCOPE} ${PROFILE_SCOPES}`,
      hint: accountHint || undefined,
      callback: (response: GoogleTokenResponse) => {
        if (response.error || !response.access_token) {
          pendingReject?.(new Error(response.error_description || response.error || "Google sign-in failed."));
        } else {
          accessToken = response.access_token;
          tokenExpiresAt = Date.now() + ((response.expires_in ?? 3600) - 30) * 1000;
          pendingResolve?.(response.access_token);
        }
        pendingResolve = null;
        pendingReject = null;
      },
      error_callback: (error: GooglePromptError) => {
        pendingReject?.(new Error(mapPromptError(error)));
        pendingResolve = null;
        pendingReject = null;
      },
    });
  }
};

export const preloadCloudDriveAuth = async () => {
  try {
    await ensureTokenClient();
  } catch {
    // Ignore prewarm errors; the connect action will surface them if needed.
  }
};

/**
 * Opens the Google OAuth popup using the pre-initialized shared token client.
 * MUST be called synchronously from a user click handler to avoid popup blocking.
 * The tokenClient must already be initialized via preloadCloudDriveAuth().
 */
const requestAccessTokenImmediate = (prompt: "consent" | "") => {
  if (!tokenClient) {
    return Promise.reject(new Error("Google sign-in is still loading. Wait a moment and try again."));
  }

  return new Promise<string>((resolve, reject) => {
    // Swap the shared callbacks to this request's resolve/reject
    pendingResolve = resolve;
    pendingReject = reject;
    // This MUST call window.open synchronously from the user gesture
    tokenClient!.requestAccessToken({ prompt });
  });
};

const requestAccessToken = async (prompt: "consent" | "" = "consent") => {
  await ensureTokenClient();
  return requestAccessTokenImmediate(prompt);
};

const getValidToken = async () => {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }
  try {
    return await requestAccessToken("");
  } catch {
    return requestAccessToken("consent");
  }
};

const driveFetch = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  const token = await getValidToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Google Drive request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

const listBackupFiles = async (): Promise<CloudBackupFileMeta[]> => {
  const query = encodeURIComponent(`'appDataFolder' in parents and trashed = false and name contains '${BACKUP_PREFIX}'`);
  const fields = encodeURIComponent("files(id,name,createdTime),nextPageToken");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&orderBy=createdTime desc&fields=${fields}&pageSize=50`;

  const data = await driveFetch<{ files?: CloudBackupFileMeta[] }>(url);
  return data.files || [];
};

const deleteFile = async (fileId: string) => {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: "DELETE" });
};

const enforceRetention = async () => {
  const files = await listBackupFiles();
  if (files.length <= RETENTION_COUNT) return;

  const stale = files.slice(RETENTION_COUNT);
  await Promise.all(stale.map((file) => deleteFile(file.id)));
};

export const connectCloudDrive = () =>
  requestAccessTokenImmediate("consent").then(async () => {
    const email = await getCloudAccountEmail();
    accountHint = email;
    return { connected: true, email };
  });

export const disconnectCloudDrive = () => {
  accessToken = null;
  tokenExpiresAt = 0;
  accountHint = null;
};

export const isCloudDriveConnected = () => !!accessToken && Date.now() < tokenExpiresAt;

export const setCloudAccountHint = (email: string | null) => {
  accountHint = email;
};

export const getCloudAccountEmail = async (): Promise<string | null> => {
  const token = await getValidToken();
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
};

export const uploadBackupToCloud = async (backup: unknown) => {
  const now = new Date().toISOString();
  const metadata = {
    name: `${BACKUP_PREFIX}${now.replace(/[:.]/g, "-")}.json`,
    mimeType: "application/json",
    parents: ["appDataFolder"],
    appProperties: {
      source: "finance-tracker",
      createdAt: now,
    },
  };

  const boundary = "financeTrackerBoundary";
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    `${JSON.stringify(backup)}\r\n` +
    `--${boundary}--`;

  const result = await driveFetch<{ id: string; createdTime?: string }>(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,createdTime",
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  await enforceRetention();
  return { id: result.id, createdTime: result.createdTime ?? new Date().toISOString() };
};

export const downloadLatestBackupFromCloud = async () => {
  const files = await listBackupFiles();
  const latest = files[0];
  if (!latest) {
    throw new Error("No cloud backup found.");
  }

  const token = await getValidToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${latest.id}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error("Failed to download latest cloud backup.");
  }

  const data = await response.json();
  return { data, file: latest };
};
