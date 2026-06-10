import { api } from "./api";

/** XHR PUT 到预签名地址，回调进度（0~100） */
export function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`上传失败（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.send(file);
  });
}

/** 单文件上传：init 预签名 → PUT → complete（入队处理）。进度阶段回调。 */
export async function uploadVideoFile(
  sessionId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  const init = await api.initVideoUpload(sessionId, {
    fileName: file.name,
    contentType: file.type || "video/mp4",
    sizeBytes: file.size
  });
  await putWithProgress(init.uploadUrl, file, init.uploadHeaders, (p) =>
    onProgress?.(p)
  );
  await api.completeVideoUpload({ videoId: init.videoId });
}
