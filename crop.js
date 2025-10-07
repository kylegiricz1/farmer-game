// ---- Base Entity ----
class Entity {
    constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.dead = false; }
    update(dt, game) { }
    draw(ctx) { }
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

export { Entity, Crop, Scarecrow };