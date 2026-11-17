/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* So de martell opcional per a la projecció (desactivat per defecte) */

import { STORAGE_KEYS } from './config.js?v=1.3.0';

class MartellAudio {
  constructor() {
    this.ctx = null;
    this.activat = localStorage.getItem(STORAGE_KEYS.SO_MARTELL) === '1';
  }

  _garanteixCtx() {
    if (!this.activat) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  commuta() {
    this.activat = !this.activat;
    try {
      localStorage.setItem(STORAGE_KEYS.SO_MARTELL, this.activat ? '1' : '0');
    } catch (_) {}
    if (this.activat) this.copSuau();
    return this.activat;
  }

  /* Cop sec de fusta per a adjudicació (doble cop de martell de subhasta) */
  martellAdjudicacio() {
    const ctx = this._garanteixCtx();
    if (!ctx) return;
    this._copFusta(ctx, ctx.currentTime, 190, 0.14);
    this._copFusta(ctx, ctx.currentTime + 0.16, 155, 0.18);
  }

  copSuau() {
    const ctx = this._garanteixCtx();
    if (!ctx) return;
    this._copFusta(ctx, ctx.currentTime, 210, 0.1);
  }

  _copFusta(ctx, t0, freq, amp) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(52, t0 + 0.09);

    gain.gain.setValueAtTime(amp, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  }
}

export const soMartell = new MartellAudio();
