/**
 * Reusable error messages and instructions for photo upload failures
 */

export const PHOTO_UPLOAD_ERROR_MESSAGES = {
  title: "Photo upload failed",
  description: "Please refresh your browser and clear cookies, then try again. To clear cookies: Chrome/Edge - Settings > Privacy > Clear browsing data > Cookies. Firefox - Settings > Privacy > Clear Data > Cookies. Safari - Develop > Empty Caches.",
} as const;

export const PHOTO_UPLOAD_SUCCESS_MESSAGES = {
  single: {
    title: "Photo uploaded successfully!",
    description: "Your space photo has been uploaded.",
  },
  multiple: (count: number) => ({
    title: "Photos uploaded successfully!",
    description: `${count} photo(s) uploaded. Ready for AI analysis!`,
  }),
} as const;

/**
 * Get the appropriate error message for photo upload failures
 * @param isMultiple - Whether multiple photos were being uploaded
 * @returns Error message object with title and description
 */
export function getPhotoUploadErrorMessage(isMultiple: boolean = false) {
  return {
    title: PHOTO_UPLOAD_ERROR_MESSAGES.title,
    description: PHOTO_UPLOAD_ERROR_MESSAGES.description,
  };
}

/**
 * Get the appropriate success message for photo uploads
 * @param count - Number of photos uploaded
 * @returns Success message object with title and description
 */
export function getPhotoUploadSuccessMessage(count: number = 1) {
  if (count === 1) {
    return PHOTO_UPLOAD_SUCCESS_MESSAGES.single;
  }
  return PHOTO_UPLOAD_SUCCESS_MESSAGES.multiple(count);
}
