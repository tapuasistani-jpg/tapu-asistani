/** Tapu analizi sekmeleri — yalnızca PDF */
export const PDF_ACCEPT = "application/pdf,.pdf";

/** Proje ölçüm aracı — görsel veya PDF */
export const PROJECT_IMAGE_ACCEPT =
  "image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png,application/pdf,.pdf";

export const PROJECT_PLAN_ACCEPT = PROJECT_IMAGE_ACCEPT;

export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

export function isProjectImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg" || type === "image/png") {
    return true;
  }
  return (
    name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png")
  );
}

export const PDF_ONLY_MESSAGE =
  "Yalnızca PDF dosyası yükleyebilirsiniz (.pdf).";

export const IMAGE_ONLY_MESSAGE =
  "Yalnızca JPG, JPEG, PNG görsel veya PDF yükleyebilirsiniz.";

export function isProjectPlanFile(file: File): boolean {
  return isProjectImageFile(file) || isPdfFile(file);
}
