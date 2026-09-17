// A JPEG copy of an uploaded image, drawn in the browser. The server has no
// image library, so this is where a phone photo gets made small.
//
// Used for the Student Work cover of an assignment upload (1200px wide) and for
// the display copy of an image on a whiteboard (1600px on the long side). The
// server drops a copy over 2MB, and a PNG of a phone photo can pass that, so
// this is a JPEG and steps its quality down until it is under `maxBytes`.
const isImage = (f) => /\.(png|jpe?g|webp|gif)$/i.test(f?.name ?? '');

export async function drawCopy(file, { width = null, longSide = null, qualities = [0.85, 0.7, 0.5], maxBytes = 1_000_000 } = {}) {
  if (!isImage(file)) return null;
  try {
    const bmp = await createImageBitmap(file);
    const scale = longSide
      ? Math.min(1, longSide / Math.max(bmp.width, bmp.height))
      : Math.min(1, (width ?? bmp.width) / bmp.width);
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // JPEG has no transparency; without a fill, a transparent PNG turns black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    for (const quality of qualities) {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
      if (blob && blob.size < maxBytes) return blob;
    }
    return null;
  } catch {
    return null;
  }
}
