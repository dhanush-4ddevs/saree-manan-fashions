import { getStorage, ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { storage } from '../../app/config/firebase';

/**
 * Uploads an image to Firebase Storage with fallback mechanisms
 * @param imageDataUrl - The data URL of the image
 * @param path - Optional path to store the image (defaults to 'vouchers')
 * @param fileName - Optional file name (defaults to a timestamp)
 * @returns The download URL of the uploaded image
 */
export const uploadImageFromDataUrl = async (
  imageDataUrl: string,
  path: string = 'vouchers',
  fileName: string = `image_${Date.now()}.jpg`
): Promise<string> => {
  try {
    // If not a data URL, return the URL as is
    if (!imageDataUrl.startsWith('data:')) {
      return imageDataUrl;
    }

    // Create storage reference
    const storageRef = ref(storage, `${path}/${fileName}`);

    // Try different methods to handle cross-origin issues
    try {
      // Method 1: Try base64 upload first (most reliable for CORS)
      console.log("Attempting upload with base64 method...");
      const base64Data = imageDataUrl.includes('base64,')
        ? imageDataUrl.split('base64,')[1]
        : imageDataUrl;

      const snapshot = await uploadString(storageRef, base64Data, 'base64');
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (method1Error) {
      console.warn("Base64 upload failed, trying blob method:", method1Error);

      // Method 2: Try blob upload as fallback
      try {
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();
        const snapshot = await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return downloadUrl;
      } catch (method2Error) {
        console.warn("Blob upload failed, trying data_url method:", method2Error);

        // Method 3: Try direct data_url upload as final attempt
        const snapshot = await uploadString(storageRef, imageDataUrl, 'data_url');
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return downloadUrl;
      }
    }
  } catch (error: any) {
    console.error('All image upload methods failed:', error);
    throw new Error(`Failed to upload image: ${error.message || 'Unknown error'}`);
  }
};
