import ch01 from '@/assets/ebook/ch01-dashboard.png';
import ch02 from '@/assets/ebook/ch02-monitoramento.png';
import ch03 from '@/assets/ebook/ch03-chat-pregao.png';
import ch04 from '@/assets/ebook/ch04-proposta.png';
import ch05 from '@/assets/ebook/ch05-precificacao.png';
import ch06 from '@/assets/ebook/ch06-apoio-juridico.png';
import ch07 from '@/assets/ebook/ch07-documentos.png';
import ch08 from '@/assets/ebook/ch08-kanban.png';
import ch09 from '@/assets/ebook/ch09-robo-lances.png';
import ch10 from '@/assets/ebook/ch10-multiempresa.png';

const IMAGE_URLS: Record<number, string> = {
  1: ch01,
  2: ch02,
  3: ch03,
  4: ch04,
  5: ch05,
  6: ch06,
  7: ch07,
  8: ch08,
  9: ch09,
  10: ch10,
};

function urlToDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failed'));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export async function loadChapterImages(): Promise<Record<number, string>> {
  const entries = Object.entries(IMAGE_URLS);
  const results: Record<number, string> = {};

  await Promise.all(
    entries.map(async ([key, url]) => {
      try {
        results[Number(key)] = await urlToDataUrl(url);
      } catch (e) {
        console.warn(`Could not load image for chapter ${key}:`, e);
      }
    }),
  );

  return results;
}
