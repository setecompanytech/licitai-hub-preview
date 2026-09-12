/**
 * Som e vibração dos alertas de convocação — a autoridade única.
 *
 * O beep morava dentro de MonitoramentoChat e só existia com a tela aberta.
 * Convocação de pregoeiro não espera ninguém estar na tela certa: o lembrete
 * global (LembreteDeConvocacao, no AppLayout) e a página compartilham ESTA
 * lib, senão viram dois volumes divergentes para o mesmo alarme.
 *
 * Volume é preferência da PESSOA neste navegador — localStorage, não banco.
 * Vibração usa a API padrão (navigator.vibrate): funciona em celular/tablet
 * Android; iPhone e desktop ignoram em silêncio — por isso ela acompanha o
 * som em vez de substituí-lo.
 */

export type TipoAlerta = 'convocacao' | 'mensagem' | 'alerta';

export type ConfigSom = {
  /** 0–1 (razão derivada, convenção do repo). */
  volume: number;
  mudo: boolean;
};

const CHAVE = 'praefectus:alerta-som';
const PADRAO: ConfigSom = { volume: 0.7, mudo: false };

export function lerConfigSom(): ConfigSom {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return PADRAO;
    const lido = JSON.parse(cru) as Partial<ConfigSom>;
    const volume = typeof lido.volume === 'number' ? Math.min(1, Math.max(0, lido.volume)) : PADRAO.volume;
    return { volume, mudo: lido.mudo === true };
  } catch {
    return PADRAO;
  }
}

export function gravarConfigSom(config: ConfigSom) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(config));
  } catch {
    /* modo privado sem storage: o som segue com o padrão da sessão */
  }
}

let audioCtx: AudioContext | null = null;

/**
 * Toca o alerta no volume configurado. `volumeForcado` serve ao feedback do
 * slider (ouvir o volume ENQUANTO ajusta, antes de gravar).
 */
export function tocarAlerta(tipo: TipoAlerta, volumeForcado?: number) {
  const config = lerConfigSom();
  const volume = volumeForcado ?? (config.mudo ? 0 : config.volume);
  if (volume <= 0) return;
  try {
    if (!audioCtx) {
      // deno-lint não se aplica; cast para o webkit legado do Safari.
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioCtx;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Ganhos históricos da tela (0.3/0.2/0.15) eram o "volume 100%";
    // o slider multiplica sobre eles.
    if (tipo === 'convocacao') {
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.3 * volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } else if (tipo === 'alerta') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gainNode.gain.setValueAtTime(0.2 * volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } else {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(520, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.15 * volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    }
  } catch {
    /* autoplay bloqueado antes do primeiro gesto: o alerta visual segue */
  }
}

/** Padrões de vibração por gravidade — convocação insiste, menção só cutuca. */
export function vibrar(tipo: TipoAlerta) {
  const config = lerConfigSom();
  // Volume no zero é o mesmo gesto de silenciar: vibração acompanha o som.
  if (config.mudo || config.volume <= 0) return;
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (tipo === 'convocacao') navigator.vibrate([250, 120, 250, 120, 500]);
    else if (tipo === 'alerta') navigator.vibrate([200, 100, 200]);
    else navigator.vibrate(120);
  } catch {
    /* sem suporte: silêncio */
  }
}
