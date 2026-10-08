import api from '../api/client.js';

/**
 * Downloads a file from an authenticated endpoint as a Blob.
 * Triggers browser download with proper filename extracted from headers or fallback.
 */
export async function downloadAuthenticatedBlob({
  url,
  defaultFilename = 'document.pdf',
  onStart,
  onSuccess,
  onError
} = {}) {
  try {
    if (onStart) onStart();

    const response = await api.get(url, {
      responseType: 'blob'
    });

    // Check if the server returned a JSON error payload with blob content-type
    if (response.data && response.data.type === 'application/json') {
      const text = await response.data.text();
      const json = JSON.parse(text);
      throw new Error(json.error?.message || 'Download failed');
    }

    // Extract filename from Content-Disposition header if available
    let filename = defaultFilename;
    const disposition = response.headers?.['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '').trim();
      }
    }

    const blob = new Blob([response.data], {
      type: response.headers?.['content-type'] || 'application/pdf'
    });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);

    if (onSuccess) onSuccess(filename);
    return { ok: true, filename };
  } catch (err) {
    let message = 'Failed to download file';
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        message = json.error?.message || message;
      } catch {
        // use default message
      }
    } else if (err.response?.data?.error?.message) {
      message = err.response.data.error.message;
    } else if (err.message) {
      message = err.message;
    }

    if (onError) onError(message);
    return { ok: false, error: message };
  }
}

export default {
  downloadAuthenticatedBlob
};

