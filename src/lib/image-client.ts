/** Client-only image downscaler. Keeps uploads inside the JSON document. */
export async function resizeImage(
  file: File,
  options: {
    width: number;
    height: number;
    fit?: "cover" | "contain";
    quality?: number;
    format?: "image/jpeg" | "image/png";
  },
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not read the image"));
    element.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  if (options.fit === "contain") {
    context.fillStyle = "#fffcf6";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const scale =
    options.fit === "contain"
      ? Math.min(options.width / image.width, options.height / image.height)
      : Math.max(options.width / image.width, options.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(
    image,
    (options.width - width) / 2,
    (options.height - height) / 2,
    width,
    height,
  );
  return canvas.toDataURL(
    options.format ?? "image/jpeg",
    options.format === "image/png" ? undefined : options.quality ?? 0.82,
  );
}
