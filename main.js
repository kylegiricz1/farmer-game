// =========================
// Farmer Harvest — no libs
// =========================

// ---- Config & helpers ----
const WIDTH = 900, HEIGHT = 540;
const TILE = 30;           // for a subtle grid
const GAME_LEN = 60;       // seconds
const GOAL = 15;           // crops to win

const State = Object.freeze({ MENU: "MENU", PLAYING: "PLAYING", PAUSED: "PAUSED", GAME_OVER: "GAME_OVER", WIN: "WIN" });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ---- Base Entity ----
class Entity {
    constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.dead = false; }
    update(dt, game) { }
    draw(ctx) { }
}

// ---- Farmer (player) ----
class Farmer extends Entity {
    constructor(x, y) {
        super(x, y, 34, 34);
        this.speed = 260;
        this.vx = 0; this.vy = 0;
        this.color = "#8b5a2b";
    }
    handleInput(input) {
        const L = input.keys.has("ArrowLeft"), R = input.keys.has("ArrowRight");
        const U = input.keys.has("ArrowUp"), D = input.keys.has("ArrowDown");
        this.vx = (R - L) * this.speed;
        this.vy = (D - U) * this.speed;
    }
    update(dt, game) {
        // try movement
        const oldX = this.x, oldY = this.y;
        this.x = clamp(this.x + this.vx * dt, 0, WIDTH - this.w);
        this.y = clamp(this.y + this.vy * dt, 0, HEIGHT - this.h);
        // block through obstacles
        const hitObs = game.obstacles.some(o => aabb(this, o));
        if (hitObs) { this.x = oldX; this.y = oldY; }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = "#c28e0e";
        ctx.fillRect(this.x + 4, this.y - 6, this.w - 8, 8);        // hat brim
        ctx.fillRect(this.x + 10, this.y - 18, this.w - 20, 12);    // hat top
    }
}

// ---- Crop (collectible) ----
class Crop extends Entity {
    constructor(x, y, type = "wheat") {
        super(x, y, 20, 26);
        this.type = type;
        this.sway = Math.random() * Math.PI * 2;
    }
    update(dt, game) { this.sway += dt * 2; }
    draw(ctx) {
        const { x, y, w, h } = this;
        ctx.strokeStyle = "#2f7d32";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h);
        ctx.quadraticCurveTo(x + w / 2 + Math.sin(this.sway) * 3, y + h / 2, x + w / 2, y);
        ctx.stroke();
        if (this.type === "wheat") ctx.fillStyle = "#d9a441";
        else if (this.type === "corn") ctx.fillStyle = "#f6e05e";
        else if (this.type === "carrot") ctx.fillStyle = "#e67e22";
        else if (this.type === "beet") ctx.fillStyle = "#8e44ad";
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---- Scarecrow (obstacle) ----
class Scarecrow extends Entity {
    constructor(x, y) { 
        super(x, y, 26, 46);
        this.hit = false;
     }
    draw(ctx) {
        const { x, y, w, h } = this;
        ctx.fillStyle = "#9b7653";
        ctx.fillRect(x + w / 2 - 3, y, 6, h); // pole
        ctx.fillStyle = "#c28e0e";
        ctx.beginPath(); ctx.arc(x + w / 2, y + 10, 10, 0, Math.PI * 2); ctx.fill(); // head
        ctx.strokeStyle = "#6b4f2a"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x + w, y + 18); ctx.stroke(); // arms
    }
}

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
