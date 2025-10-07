# farmer-game

A simple browser-based farming game built with vanilla JavaScript. Players control a farmer to collect crops while avoiding obstacles.

---

## New Features

1. Time Subtraction on Scarecrow Hit
   - When the scarecrow hits the player, time is subtracted from the remaining game timer, increasing difficulty. I could not figure out how to correctly implement this. I believe it has something to do with the hitboxes.

2. Different Types of Pickups 
   - Added variety to pickups beyond standard crops:
        -Wheat,Corn, Carot, Beet
   - These add strategic choices for the player.

---

## Arrow Functions, `this`, and `bind`

- Arrow Functions 
  - Used in event listeners to preserve `this` context:
    
    if (this.ui.start) this.ui.start.addEventListener("click", () => this.start());
  
    - `this` refers to the `Game` instance, not the button element.

- `.bind(this)`  
  - Used when passing class methods as callbacks:
    
    this._onKeyDown = this.onKeyDown.bind(this);
    
    - Ensures `this` refers to the `Input` instance rather than the global object.

- How It Works
  - Normal functions have their own `this`, which can change depending on how the function is called.  
  - Arrow functions inherit `this` from their enclosing context (lexical scope).  
  - `.bind(this)` explicitly sets `this` for a function when called.


