// =========================
// Farmer Harvest — no libs
// =========================

import { Crop, Scarecrow } from './farmer-game/crop.js';
import { Farmer, clamp, aabb, WIDTH, HEIGHT } from './farmer-game/farmer.js';

// ---- Config & helpers ----
const TILE = 30;           // for a subtle grid
const GAME_LEN = 60;       // seconds
const GOAL = 15;           // crops to win

const State = Object.freeze({ MENU: "MENU", PLAYING: "PLAYING", PAUSED: "PAUSED", GAME_OVER: "GAME_OVER", WIN: "WIN" });

// ---- Input (uses .bind to control `this`) ----
class Input {
    constructor(game) {
        this.game = game;
        this.keys = new Set();
        // We must use .bind(this) because event listeners call the handler as a plain function,
        // so without binding, 'this' would be the global window instead of our Input instance.
        this._onKeyDown = this.onKeyDown.bind(this); // bind #1 — ensures 'this' refers to Input instance in event listener
        this._onKeyUp = this.onKeyUp.bind(this);     // bind #2 — same reason
        window.addEventListener("keydown", this._onKeyDown);
        window.addEventListener("keyup", this._onKeyUp);
    }
    onKeyDown(e) {
        if (e.key === "p" || e.key === "P") this.game.togglePause();
        this.keys.add(e.key);
    }
    onKeyUp(e) { this.keys.delete(e.key); }
    dispose() {
        window.removeEventListener("keydown", this._onKeyDown);
        window.removeEventListener("keyup", this._onKeyUp);
    }
}

// ---- Game ----
class Game {
    constructor(canvas) {
        if (!canvas) {
            console.error("Canvas #game not found. Check index.html IDs.");
            return;
        }
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.state = State.MENU;

        // world
        this.player = new Farmer(WIDTH / 2 - 17, HEIGHT - 80);
        this.crops = [];
        this.obstacles = [];
        

        // timing
        this.lastTime = 0;
        this.timeLeft = GAME_LEN;
        this.spawnEvery = 0.8;
        this._accumSpawn = 0;

        // score & goal
        this.score = 0;
        this.goal = GOAL;

        // input & resize
        this.input = new Input(this);
        this._onResize = this.onResize.bind(this);
        window.addEventListener("resize", this._onResize);

        // UI
        const get = id => document.getElementById(id) || console.error(`#${id} not found`);
        this.ui = {
            score: get("score"),
            time: get("time"),
            goal: get("goal"),
            status: get("status"),
            start: get("btnStart"),
            reset: get("btnReset"),
        };
        if (this.ui.goal) this.ui.goal.textContent = String(this.goal);
        // Using an arrow here makes 'this' stay bound to Game instance.
        // If we used a normal function, 'this' would refer to the button element instead.
        if (this.ui.start) this.ui.start.addEventListener("click", () => this.start()); // arrow keeps `this`
        if (this.ui.reset) this.ui.reset.addEventListener("click", () => this.reset());

        // RAF loop as arrow function → lexical `this`
        this.tick = (ts) => {
            const dt = Math.min((ts - this.lastTime) / 1000, 0.033); // ~30ms cap
            this.lastTime = ts;
            this.update(dt);
            this.render();
            requestAnimationFrame(this.tick);
        };
    }

    onResize() {
        // fixed canvas size for simplicity; handle DPR here if desired
    }

    start() {
        if (this.state === State.MENU || this.state === State.GAME_OVER || this.state === State.WIN) {
            this.reset();
            this.state = State.PLAYING;
            if (this.ui.status) this.ui.status.textContent = "Playing…";
            requestAnimationFrame(this.tick);
        } else if (this.state === State.PAUSED) {
            this.state = State.PLAYING;
            if (this.ui.status) this.ui.status.textContent = "Playing…";
        }
    }

    reset() {
        this.state = State.MENU;
        this.player = new Farmer(WIDTH / 2 - 17, HEIGHT - 80);
        this.crops.length = 0;
        this.obstacles.length = 0;
        this.score = 0;
        this.timeLeft = GAME_LEN;
        this._accumSpawn = 0;
        this.lastTime = performance.now();
        // place a couple of scarecrows
        this.obstacles.push(new Scarecrow(200, 220), new Scarecrow(650, 160));
        this.syncUI();
        if (this.ui.status) this.ui.status.textContent = "Menu";
    }

    togglePause() {
        if (this.state === State.PLAYING) {
            this.state = State.PAUSED;
            if (this.ui.status) this.ui.status.textContent = "Paused";
        } else if (this.state === State.PAUSED) {
            this.state = State.PLAYING;
            if (this.ui.status) this.ui.status.textContent = "Playing…";
        }
    }

    syncUI() {
        if (this.ui.score) this.ui.score.textContent = String(this.score);
        if (this.ui.time) this.ui.time.textContent = Math.ceil(this.timeLeft);
        if (this.ui.goal) this.ui.goal.textContent = String(this.goal);
    }

    spawnCrop() {
        const types = ["wheat", "corn", "carrot", "beet"];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const gx = Math.floor(Math.random() * ((WIDTH - 2 * TILE) / TILE)) * TILE + TILE;
        const gy = Math.floor(Math.random() * ((HEIGHT - 2 * TILE) / TILE)) * TILE + TILE;
        this.crops.push(new Crop(gx, gy, randomType));
    }

    update(dt) {
        if (this.state !== State.PLAYING) return;

        // countdown
        this.timeLeft = clamp(this.timeLeft - dt, 0, GAME_LEN);
        if (this.timeLeft <= 0) {
            this.state = (this.score >= this.goal) ? State.WIN : State.GAME_OVER;
            if (this.ui.status) this.ui.status.textContent = (this.state === State.WIN) ? "You Win!" : "Game Over";
            this.syncUI();
            return;
        }

        // player
        this.player.handleInput(this.input);
        this.player.update(dt, this);

        // spawn crops
        this._accumSpawn += dt;
        while (this._accumSpawn >= this.spawnEvery) {
            this._accumSpawn -= this.spawnEvery;
            this.spawnCrop();
        }

        this.obstacles.forEach(crow => {
        if (!crow.hit && aabb(this.player, crow)) {
            this.timeLeft = Math.max(this.timeLeft - 1, 0);
            crow.hit = true;
        }});

        // collect crops
        const collected = this.crops.filter(c => aabb(this.player, c));     // arrow #1 this uses this from game.
        if (collected.length) {
            collected.forEach(c => {
                
                c.dead = true;
                switch (c.type) {
                case "wheat":
                    this.score += 1;
                    break;
                case "corn":
                    this.score += 2;
                    break;
                case "carrot":
                    this.score += 3;
                    break;
                default:
                    this.score += 1;
                    break;
                }
            })                             // arrow #2 keeps same this
            
            if (this.ui.score) this.ui.score.textContent = String(this.score);
            if (this.score >= this.goal) {
                this.state = State.WIN;
                if (this.ui.status) this.ui.status.textContent = "You Win!";
            }
        }
        this.crops = this.crops.filter(c => !c.dead);                        // arrow #3 inherits this from game
        this.crops.forEach(c => c.update(dt, this));                         // arrow #4 uses this from game

        // timer UI
        if (this.ui.time) this.ui.time.textContent = Math.ceil(this.timeLeft);
    }

    render() {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        // field background (grid)
        ctx.fillStyle = "#dff0d5";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.strokeStyle = "#c7e0bd";
        ctx.lineWidth = 1;
        for (let y = TILE; y < HEIGHT; y += TILE) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
        }
        for (let x = TILE; x < WIDTH; x += TILE) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
        }

        // crops, obstacles, farmer
        this.crops.forEach(c => c.draw(ctx));                                 // arrow #5
        this.obstacles.forEach(o => o.draw(ctx));                             // arrow #6
        this.player.draw(ctx);

        // state labels
        ctx.fillStyle = "#333";
        ctx.font = "16px system-ui, sans-serif";
        if (this.state === State.MENU) {
            ctx.fillText("Press Start to play", 20, 28);
        } else if (this.state === State.PAUSED) {
            ctx.fillText("Paused (press P to resume)", 20, 28);
        } else if (this.state === State.GAME_OVER) {
            ctx.fillText("Time up! Press Reset to return to Menu", 20, 28);
        } else if (this.state === State.WIN) {
            ctx.fillText("Harvest complete! Press Reset for another round", 20, 28);
        }
    }

    dispose() {
        this.input.dispose();
        window.removeEventListener("resize", this._onResize);
    }
}

// ---- Boot ----
const canvas = document.getElementById("game");
const game = new Game(canvas);
// Click "Start" in the UI to begin.