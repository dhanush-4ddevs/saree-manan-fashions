export interface ImageWithWatermark {
  id: string;
  file: File;
  dataUrl: string;
  watermarkedDataUrl: string;
}

export const addWatermarkToImage = (
  imageDataUrl: string,
  watermarkText: string
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Set canvas dimensions to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the original image
      ctx!.drawImage(img, 0, 0);

      // Calculate appropriate font size based on image dimensions
      // Use smaller divisors to increase font size
      const maxFontSize = Math.min(img.width / 20, img.height / 12);
      const minFontSize = 18;
      const fontSize = Math.max(maxFontSize, minFontSize);

      // Set initial font to measure text
      ctx!.font = `bold ${fontSize}px Arial`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';

      // Measure text dimensions
      const textMetrics = ctx!.measureText(watermarkText);
      const textWidth = textMetrics.width;
      const textHeight = fontSize; // Approximate height

      // Calculate padding from edges (10% of image dimensions)
      const paddingX = img.width * 0.1;
      const paddingY = img.height * 0.1;

      // Check if text fits within image boundaries when rotated
      if (textWidth > img.height - (paddingY * 2)) {
        // Text is too tall when rotated, reduce font size
        const scaleFactor = (img.height - (paddingY * 2)) / textWidth;
        const newFontSize = Math.max(fontSize * scaleFactor, minFontSize);
        ctx!.font = `bold ${newFontSize}px Arial`;
      }

      // Configure watermark style
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx!.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx!.lineWidth = Math.max(1, fontSize / 20); // Proportional line width

      // Position watermark horizontally (rotated 90 degrees)
      const x = canvas.width * 0.7; // Position at 70% from left
      const y = canvas.height / 2; // Center vertically

      // Ensure text doesn't go outside image boundaries
      const finalX = Math.min(x, canvas.width - paddingX - (fontSize / 2));

      // Save the current context state
      ctx!.save();

      // Translate to the position where we want to draw the text
      ctx!.translate(finalX, y);

      // Rotate the context by 90 degrees (π/2 radians)
      ctx!.rotate(Math.PI / 2);

      // Draw watermark with stroke and fill (at origin since we translated)
      ctx!.strokeText(watermarkText, 0, 0);
      ctx!.fillText(watermarkText, 0, 0);

      // Restore the context state
      ctx!.restore();

      // Convert to data URL
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };

    img.src = imageDataUrl;
  });
};

export const resizeImage = (
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw resized image
      ctx!.drawImage(img, 0, 0, width, height);

      // Convert to data URL
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const generateImageId = (): string => {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
