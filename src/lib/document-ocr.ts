import { supabase } from '@/integrations/supabase/client';

export type VisionImagePayload = {
  name: string;
  dataUrl: string;
};

export async function extractTextFromVisionImages(
  images: VisionImagePayload[],
  fileName: string,
): Promise<string> {
  const sanitizedImages = images
    .filter((image) => image.dataUrl.startsWith('data:image/'))
    .slice(0, 4);

  if (sanitizedImages.length === 0) {
    return '';
  }

  const { data, error } = await supabase.functions.invoke('document-vision-extract', {
    body: {
      fileName,
      images: sanitizedImages,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.text === 'string' ? data.text.trim() : '';
}