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
      let fontSize = Math.max(maxFontSize, minFontSize);

      // Set initial font to measure text
      ctx!.font = `bold ${fontSize}px Arial`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';

      // Measure text dimensions
      let textMetrics = ctx!.measureText(watermarkText);
      let textWidth = textMetrics.width;
      const textHeight = fontSize; // Approximate height

      // Calculate padding from edges (10% of image dimensions)
      const paddingX = img.width * 0.1;
      const paddingY = img.height * 0.1;

      // Ensure text fits within image width (horizontal watermark)
      if (textWidth > canvas.width - (paddingX * 2)) {
        const scaleFactor = (canvas.width - (paddingX * 2)) / textWidth;
        fontSize = Math.max(fontSize * scaleFactor, minFontSize);
        ctx!.font = `bold ${fontSize}px Arial`;
        textMetrics = ctx!.measureText(watermarkText);
        textWidth = textMetrics.width;
      }

      // Configure watermark style
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx!.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx!.lineWidth = Math.max(1, fontSize / 20); // Proportional line width

      // Position watermark horizontally centered in the image
      const x = canvas.width / 2;
      const y = canvas.height / 2;

      // Draw watermark with stroke and fill at the center
      ctx!.strokeText(watermarkText, x, y);
      ctx!.fillText(watermarkText, x, y);

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
