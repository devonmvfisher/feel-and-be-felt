// Browser binary fetch with bounded wait and byte progress; injectable transport
// lets Node test the actual reader offline. No 3D library is imported here.
export async function readBinary(url, {onProgress = () => {}, expectedBytes = 0, timeoutMs = 15000, fetchImpl = fetch} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {signal: controller.signal});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const total = Number(response.headers.get('content-length')) || expectedBytes;
    if (!response.body?.getReader) {
      const bytes = new Uint8Array(await response.arrayBuffer()); onProgress({loaded: bytes.length, total}); return bytes;
    }
    const reader = response.body.getReader(), chunks = []; let length = 0;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      chunks.push(value); length += value.length; onProgress({loaded: length, total});
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
    return bytes;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Model download timed out; using a box.');
    throw error;
  } finally {clearTimeout(timer);}
}
