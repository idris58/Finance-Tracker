const GOOGLE_GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_PREFIX = "finance-backup-";
const RETENTION_COUNT = 2;

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleOauth2 = {
  initTokenClient: (options: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
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

const getClientId = () => import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

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
      scope: DRIVE_SCOPE,
      callback: () => {
        // callback is replaced per-request in requestAccessToken.
      },
    });
  }
};

const requestAccessToken = async (prompt: "consent" | "" = "consent") => {
  await ensureTokenClient();

  return new Promise<string>((resolve, reject) => {
    const googleWindow = window as GoogleWindow;
    const oauth2 = googleWindow.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new Error("Google Identity API is unavailable."));
      return;
    }

    const clientId = getClientId();
    if (!clientId) {
      reject(new Error("Google Client ID is missing. Add VITE_GOOGLE_CLIENT_ID in your environment."));
      return;
    }

    const oneShotClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response: GoogleTokenResponse) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || "Google sign-in failed."));
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + ((response.expires_in ?? 3600) - 30) * 1000;
        resolve(response.access_token);
      },
    });

    oneShotClient.requestAccessToken({ prompt });
  });
};

const getValidToken = async () => {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }
  return requestAccessToken("consent");
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

export const connectCloudDrive = async () => {
  await requestAccessToken("consent");
  return { connected: true };
};

export const disconnectCloudDrive = () => {
  accessToken = null;
  tokenExpiresAt = 0;
};

export const isCloudDriveConnected = () => !!accessToken && Date.now() < tokenExpiresAt;

export const uploadBackupToCloud = async (backup: unknown) => {
  const metadata = {
    name: `${BACKUP_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    mimeType: "application/json",
    parents: ["appDataFolder"],
    appProperties: {
      source: "finance-tracker",
      createdAt: new Date().toISOString(),
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

