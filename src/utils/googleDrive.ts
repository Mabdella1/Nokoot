/**
 * Google Drive API Service for Noqoot App Backups
 */

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface SearchResponse {
  files: GoogleDriveFile[];
}

/**
 * Search for the backup file in the user's Google Drive
 */
export async function findBackupFile(accessToken: string): Promise<string | null> {
  try {
    const query = encodeURIComponent("name = 'noqoot_backup.json' and trashed = false");
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`Google Drive API error: ${response.status} - ${errorMsg}`);
    }

    const data: SearchResponse = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error searching Google Drive:", error);
    throw error;
  }
}

/**
 * Backup current data to Google Drive.
 * If file exists, it overwrites it. If not, it creates it.
 */
export async function uploadBackupToDrive(
  accessToken: string,
  backupData: any
): Promise<string> {
  try {
    // 1. Search if the file already exists
    let fileId = await findBackupFile(accessToken);

    if (!fileId) {
      // 2. File doesn't exist, create metadata first
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'noqoot_backup.json',
          mimeType: 'application/json',
          description: 'نسخة احتياطية سحابية لتطبيق كشف النقوط والمناسبات',
        }),
      });

      if (!createResponse.ok) {
        const errText = await createResponse.text();
        throw new Error(`Failed to create Google Drive file metadata: ${errText}`);
      }

      const createdFile: GoogleDriveFile = await createResponse.json();
      fileId = createdFile.id;
    }

    // 3. Upload/Overwrite the actual backup content using the PATCH upload REST API
    const uploadResponse = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupData),
      }
    );

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`Failed to upload content to Google Drive: ${errText}`);
    }

    return fileId;
  } catch (error) {
    console.error("Error uploading backup to Google Drive:", error);
    throw error;
  }
}

/**
 * Download/Restore backup from Google Drive
 */
export async function downloadBackupFromDrive(
  accessToken: string,
  fileId: string
): Promise<any> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to download backup file from Google Drive: ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error downloading backup from Google Drive:", error);
    throw error;
  }
}
