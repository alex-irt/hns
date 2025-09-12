export class Input {
    buttonsPressed: { [key: string]: boolean } = {};
    buttonsHeld: { [key: string]: number } = {};
    private buttonsStartHeld: { [key: string]: number } = {};
    buttonsReleased: { [key: string]: boolean } = {};

    modifiers: { [key: string]: boolean } = {
        ctrl: false,
        shift: false,
        alt: false
    };

    mouseDeltaBetweenFrames: { x: number, y: number } = { x: 0, y: 0 };

    private lastMousePosition: { x: number, y: number } = { x: 0, y: 0 };
    mouseDelta: { x: number, y: number } = { x: 0, y: 0 };
    private mouseWheelBetweenFrameDelta: number = 0;
    mouseWheelDelta: number = 0;

    constructor() {
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();

            this.buttonsPressed[key] = true;
            this.buttonsStartHeld[key] = performance.now();

            this.modifiers['ctrl'] = event.ctrlKey;
            this.modifiers['shift'] = event.shiftKey;
            this.modifiers['alt'] = event.altKey;
        });

        window.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();

            this.buttonsReleased[key] = true;
            delete this.buttonsHeld[key];
            delete this.buttonsStartHeld[key];

            this.modifiers['ctrl'] = event.ctrlKey;
            this.modifiers['shift'] = event.shiftKey;
            this.modifiers['alt'] = event.altKey;
        });

        window.addEventListener('mousemove', (event) => {
            this.mouseDeltaBetweenFrames.x += event.movementX;
            this.mouseDeltaBetweenFrames.y += event.movementY;
        });

        window.addEventListener('wheel', (event) => {
            this.mouseWheelBetweenFrameDelta += event.deltaY;
        });

        // add mouse button events
        window.addEventListener('mousedown', (event) => {
            this.buttonsPressed[`mouse${event.button + 1}`] = true;
            this.buttonsStartHeld[`mouse${event.button + 1}`] = performance.now();

            this.modifiers['ctrl'] = event.ctrlKey;
            this.modifiers['shift'] = event.shiftKey;
            this.modifiers['alt'] = event.altKey;
        });

        window.addEventListener('mouseup', (event) => {
            this.buttonsReleased[`mouse${event.button + 1}`] = true;
            delete this.buttonsHeld[`mouse${event.button + 1}`];
            delete this.buttonsStartHeld[`mouse${event.button + 1}`];

            this.modifiers['ctrl'] = event.ctrlKey;
            this.modifiers['shift'] = event.shiftKey;
            this.modifiers['alt'] = event.altKey;
        });
    }

    update(deltaTime: number) {
        // Update held buttons
        for (const key in this.buttonsPressed) {
            if (this.buttonsPressed[key]) {
                if (this.buttonsHeld[key]) {
                    this.buttonsHeld[key] += deltaTime;
                    this.buttonsPressed[key] = false; // Reset pressed state
                } else {
                    this.buttonsHeld[key] = performance.now() - this.buttonsStartHeld[key];
                }
            }
        }

        for (const key in this.buttonsReleased) {
            if (this.buttonsReleased[key]) {
                delete this.buttonsPressed[key]; // Reset pressed state

                if (this.buttonsHeld[key]) {
                    this.buttonsHeld[key] = 0; // Reset held state
                    this.buttonsStartHeld[key] = 0; // Reset held state
                } else {
                    this.buttonsReleased[key] = false; // Reset released state
                }
            }
        }

        this.mouseDelta.x = this.mouseDeltaBetweenFrames.x;
        this.mouseDelta.y = this.mouseDeltaBetweenFrames.y;
        this.mouseDeltaBetweenFrames.x = 0;
        this.mouseDeltaBetweenFrames.y = 0;
        
        this.mouseWheelDelta = this.mouseWheelBetweenFrameDelta;
        this.mouseWheelBetweenFrameDelta = 0;
    }
}
