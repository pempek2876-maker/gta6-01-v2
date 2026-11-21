// Missions: Jay Marlowe's five chained story jobs, plus repeatable side
// work (taxi fares, store robbery). A mission is a list of steps; each step
// has a target spot, a label for the HUD tracker, and a win condition.
// Completing a mission pays cash and starts the next one.
import { MISSIONS, ROBBERY_TAKE, TAXI_FARE } from './config.js';
import { createCar, driveCar } from './vehicles.js';

export function createMissions(world, rng, game) {
  const missions = {
    index: 0,
    step: 0,
    state: 'idle', // idle | active | done | failed
    timer: 0,
    hold: 0,
    target: null,
    chaseCar: null,
    taxi: null,
    message: '',
    messageTimer: 0,
    current() {
      return MISSIONS[this.index] || null;
    },
    currentStep() {
      const m = this.current();
      return m ? m.steps[this.step] : null;
    },
    start() {
      this.index = 0;
      this.step = 0;
      this.state = 'active';
      this.activateStep();
      this.say(`Misi 1 — ${MISSIONS[0].name}: ${MISSIONS[0].brief}`);
    },
    say(text, seconds = 5) {
      this.message = text;
      this.messageTimer = seconds;
    },
    activateStep() {
      const step = this.currentStep();
      if (!step) return;
      this.timer = step.timeLimit || 0;
      this.hold = 0;
      const spot = world.spots[step.spot];
      this.target = spot || null;
      // Show the beacon + ring on the target spot.
      for (const key of Object.keys(world.beacons)) world.beacons[key].visible = false;
      if (step.spot && world.beacons[step.spot]) {
        world.beacons[step.spot].visible = true;
        world.beacons[`${step.spot}:ring`].visible = true;
      }
      if (step.type === 'chase' && !this.chaseCar) {
        const spotPos = world.spots.courier;
        this.chaseCar = createCar(world, 'sport', spotPos.x, spotPos.z, 0, { npc: true });
        this.chaseCar.cruise = 12;
      }
      this.say(step.label);
    },
    completeStep() {
      const m = this.current();
      this.step += 1;
      if (this.step >= m.steps.length) {
        // Mission complete: pay out and move on.
        game.player.cash += m.payout;
        game.stats.missionsDone += 1;
        this.say(`Misi selesai! +$${m.payout} — ${m.name}`, 6);
        this.index += 1;
        this.step = 0;
        if (this.index >= MISSIONS.length) {
          this.state = 'done';
          this.target = null;
          for (const key of Object.keys(world.beacons)) world.beacons[key].visible = false;
          this.say('SEMUA MISI SELESAI! Jay lunas utang — Solmar City milikmu sekarang.', 10);
          game.saveGame();
          return;
        }
        const next = MISSIONS[this.index];
        this.say(`Misi ${this.index + 1} — ${next.name}: ${next.brief}`, 7);
        this.activateStep();
        return;
      }
      this.activateStep();
    },
    fail(reason) {
      this.state = 'failed';
      this.say(`Misi gagal: ${reason}. Coba lagi dari awal misi ini.`, 6);
      this.step = 0;
      this.timer = 0;
      this.activateStep();
      this.state = 'active';
    },
    // The taxi side job: a passenger waits at a kerb, pays on delivery.
    startTaxi() {
      if (this.taxi) return;
      const peds = game.peds.list.filter((p) => p.alive);
      if (peds.length === 0) return;
      const ped = peds[Math.floor(rng() * peds.length)];
      ped.isPassenger = true;
      const dest = world.spots[['garage', 'store', 'harbor', 'warehouse'][Math.floor(rng() * 4)]];
      this.taxi = { ped, dest, timer: 90, state: 'pickup' };
      this.say(`Penumpang taksi: ${ped.name} menunggu di pinggir jalan. Jemput dia!`);
    },
    update(dt) {
      if (this.messageTimer > 0) this.messageTimer -= dt;
      if (this.state !== 'active') {
        // Taxi can still run between missions.
        this.updateTaxi(dt);
        return;
      }
      const step = this.currentStep();
      if (!step) return;
      const p = game.player;
      if (step.timeLimit) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.fail('waktu habis');
          return;
        }
      }
      const dist = this.target
        ? Math.hypot(p.x - this.target.x, p.z - this.target.z)
        : 9999;
      if (step.type === 'goto') {
        if (dist < 6) this.completeStep();
      } else if (step.type === 'rob') {
        if (dist < 8) {
          // Hold still at the counter: the bag fills up.
          const still = Math.abs(p.speed) < 0.5 || p.mode === 'car';
          if (still && p.mode === 'foot') {
            this.hold += dt;
            if (this.hold >= step.holdSeconds) {
              p.cash += ROBBERY_TAKE;
              game.police.addHeat(38);
              this.say(`+$${ROBBERY_TAKE} dari brankas! Kabur sekarang!`);
              this.completeStep();
            }
          }
        }
      } else if (step.type === 'escape') {
        if (game.police.stars === 0) this.completeStep();
      } else if (step.type === 'chase') {
        const car = this.chaseCar;
        if (car) {
          // The courier flees along the roads away from the player.
          const dx = car.x - p.x;
          const dz = car.z - p.z;
          const distCar = Math.hypot(dx, dz);
          const wantHeading = Math.atan2(dx, dz);
          let dh = wantHeading - car.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          const steer = Math.max(-1, Math.min(1, dh * 1.5));
          // Ram it to slow it down.
          const playerCar = p.mode === 'car' ? p.car : null;
          if (playerCar && distCar < 5) car.speed *= Math.max(0, 1 - 2.5 * dt);
          // Drive it with the arcade physics, fleeing.
          driveCar(world, car, dt, { throttle: 1, steer, handbrake: false });
          if (distCar < 4 && Math.abs(car.speed) < 2) {
            this.say('Kurir berhenti! Uang kembali — +$400 sudah dihitung.');
            this.completeStep();
          }
        }
      }
      this.updateTaxi(dt);
    },
    updateTaxi(dt) {
      const t = this.taxi;
      if (!t) return;
      const p = game.player;
      t.timer -= dt;
      if (t.timer <= 0) {
        this.say('Penumpang taksi pergi — terlalu lama.');
        t.ped.isPassenger = false;
        this.taxi = null;
        return;
      }
      if (t.state === 'pickup') {
        if (Math.hypot(p.x - t.ped.x, p.z - t.ped.z) < 4 && p.mode === 'car') {
          t.state = 'drop';
          this.say(`Penumpang naik! Antar ke ${t.dest.label} — cepat, argo jalan.`);
        }
      } else if (Math.hypot(p.x - t.dest.x, p.z - t.dest.z) < 8) {
        p.cash += TAXI_FARE;
        this.say(`Taksi selesai! +$${TAXI_FARE}`);
        t.ped.isPassenger = false;
        this.taxi = null;
      }
    },
  };
  return missions;
}
