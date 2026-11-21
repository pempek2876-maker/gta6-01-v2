// HUD: all DOM + one 2D canvas minimap. Health/armor, cash, wanted stars,
// clock, mission tracker, speedometer, crosshair, hitmarker, message toast,
// and the title / pause / busted / wasted overlays.
import { CITY, GRID, PALETTE } from './config.js';
import { roadCoord } from './world.js';

const $ = (id) => document.getElementById(id);

export function createHud(game) {
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');

  const hud = {
    hitFlash: 0,
    hitHeadshot: false,
    hitmarker(headshot) {
      this.hitFlash = 0.35;
      this.hitHeadshot = headshot;
      const el = $('hitmarker');
      el.style.opacity = '1';
      el.style.color = headshot ? '#ff4d4d' : '#ffffff';
      setTimeout(() => { el.style.opacity = '0'; }, 180);
    },
    update(dt) {
      const p = game.player;
      const police = game.police;
      const missions = game.missions;
      // Bars.
      $('health-fill').style.width = `${Math.max(0, p.health)}%`;
      $('armor-fill').style.width = `${Math.max(0, p.armor)}%`;
      $('cash').textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
      // Wanted stars.
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < police.stars ? '★' : '☆';
      const starEl = $('wanted');
      starEl.textContent = stars;
      starEl.style.color = police.stars >= 3 ? '#ff4d4d' : '#ffd34d';
      // Clock from time of day.
      const hours = Math.floor((game.world.timeOfDay % 1) * 24);
      const mins = Math.floor(((game.world.timeOfDay % 1) * 24 * 60) % 60);
      $('clock').textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      // Mission tracker.
      const m = missions.current();
      const step = missions.currentStep();
      if (missions.state === 'active' && m && step) {
        $('mission-name').textContent = `Misi ${missions.index + 1}: ${m.name}`;
        $('mission-step').textContent = step.label;
        $('mission-timer').textContent = step.timeLimit
          ? `${Math.max(0, Math.ceil(missions.timer))} dtk`
          : '';
        $('mission-timer').style.color = missions.timer < 15 && step.timeLimit ? '#ff4d4d' : '#ffd34d';
      } else if (missions.state === 'done') {
        $('mission-name').textContent = 'Semua misi selesai!';
        $('mission-step').textContent = 'Solmar City milikmu. Kerja sampingan: taksi (T).';
        $('mission-timer').textContent = '';
      } else {
        $('mission-name').textContent = 'Solmar City';
        $('mission-step').textContent = 'Tekan M untuk mulai misi pertama.';
        $('mission-timer').textContent = '';
      }
      // Robbery progress.
      if (step && step.type === 'rob' && missions.hold > 0) {
        $('mission-step').textContent = `${step.label} — ${Math.round((missions.hold / step.holdSeconds) * 100)}%`;
      }
      // Speedometer (in car) / ammo (on foot).
      if (p.mode === 'car' && p.car) {
        $('speed').textContent = `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h`;
        $('ammo').textContent = '';
      } else {
        $('speed').textContent = '';
        $('ammo').textContent = p.reloading > 0 ? 'RELOADING…' : `🔫 ${p.ammo} / 12`;
      }
      // Crosshair only when armed on foot in live play (never in a staged shot).
      $('crosshair').style.display = p.mode === 'foot' && game.screen === 'play' && !game.shotMode ? 'block' : 'none';
      // Message toast.
      if (missions.messageTimer > 0) {
        $('toast').textContent = missions.message;
        $('toast').style.opacity = '1';
      } else {
        $('toast').style.opacity = '0';
      }
      this.drawMinimap();
    },
    drawMinimap() {
      const S = minimap.width;
      const scale = S / (CITY + 120);
      const toPx = (v) => (v + CITY / 2 + 60) * scale;
      mctx.clearRect(0, 0, S, S);
      mctx.fillStyle = 'rgba(10, 14, 22, 0.85)';
      mctx.fillRect(0, 0, S, S);
      // Sea.
      mctx.fillStyle = '#2e86ab';
      mctx.fillRect(0, toPx(330), S, S - toPx(330));
      // Roads.
      mctx.strokeStyle = '#5a5e68';
      mctx.lineWidth = 3;
      for (let i = 0; i <= GRID; i += 1) {
        const c = toPx(roadCoord(i));
        mctx.beginPath(); mctx.moveTo(c, 0); mctx.lineTo(c, S); mctx.stroke();
        mctx.beginPath(); mctx.moveTo(0, c); mctx.lineTo(S, c); mctx.stroke();
      }
      // Mission target (blinking gold diamond).
      const t = game.missions.target;
      if (t && game.missions.state === 'active') {
        const blink = Math.sin(game.time * 6) > 0 ? 1 : 0.4;
        mctx.globalAlpha = blink;
        mctx.fillStyle = '#ffd34d';
        const tx = toPx(t.x);
        const ty = toPx(t.z);
        mctx.beginPath();
        mctx.moveTo(tx, ty - 7); mctx.lineTo(tx + 6, ty); mctx.lineTo(tx, ty + 7); mctx.lineTo(tx - 6, ty);
        mctx.closePath(); mctx.fill();
        mctx.globalAlpha = 1;
      }
      // Police (blue dots) and traffic (white dots).
      mctx.fillStyle = '#2e6bff';
      for (const car of game.police.patrol) {
        mctx.beginPath(); mctx.arc(toPx(car.x), toPx(car.z), 3, 0, Math.PI * 2); mctx.fill();
      }
      mctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const car of game.traffic.cars) {
        mctx.fillRect(toPx(car.x) - 1, toPx(car.z) - 1, 2, 2);
      }
      // Player arrow (rotates with heading).
      const p = game.player;
      const px = toPx(p.x);
      const py = toPx(p.z);
      mctx.save();
      mctx.translate(px, py);
      // Canvas y points down (= +z south), arrow art points up: rotate by
      // PI - heading so it faces the player's forward vector.
      mctx.rotate(Math.PI - p.heading);
      mctx.fillStyle = p.mode === 'car' ? '#7dff9e' : '#ff8c42';
      mctx.beginPath();
      mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6);
      mctx.closePath(); mctx.fill();
      mctx.restore();
      // North marker.
      mctx.fillStyle = '#c8ccd2';
      mctx.font = 'bold 11px system-ui, sans-serif';
      mctx.fillText('N', 6, 14);
    },
    showTitle() {
      $('overlay-title').style.display = 'flex';
      $('overlay-pause').style.display = 'none';
      $('overlay-end').style.display = 'none';
    },
    showPause() {
      $('overlay-pause').style.display = 'flex';
    },
    hidePause() {
      $('overlay-pause').style.display = 'none';
    },
    showEnd(title, subtitle) {
      $('end-title').textContent = title;
      $('end-sub').textContent = subtitle;
      $('overlay-end').style.display = 'flex';
    },
    hideEnd() {
      $('overlay-end').style.display = 'none';
    },
    hideTitle() {
      $('overlay-title').style.display = 'none';
    },
  };
  return hud;
}

export { PALETTE };
