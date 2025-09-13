import { Multiplayer } from './multiplayer';
import { CanvasShader } from './voxel/CanvasShader';
import { ShaderCharacter } from './voxel/ShaderCharacter';

async function mount() {

    const canvas = document.querySelector('canvas');
    if (!canvas) {
        throw new Error("Canvas element not found");
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // new Engine(canvas);

    let lastFrameTime = performance.now();
    let startTime = performance.now();
    let framesPerSecond = 0;

    const shader = new CanvasShader(canvas);

    const blocks = await shader.init();
    const character = new ShaderCharacter(blocks);
    const multiplayer = new Multiplayer();

    document.querySelector('#loading')?.remove();

    // trap cursor
    canvas.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    // start an animation loop
    function animate() {
        const deltaTime = performance.now() - lastFrameTime;
        lastFrameTime = performance.now();
        const timeSinceStart = (performance.now() - startTime) / 1000;

        character.update(deltaTime);

        shader.render(character, Object.values(multiplayer.players));
        multiplayer.update(character);
        requestAnimationFrame(animate);

        framesPerSecond = 1000 / deltaTime;
    }
    animate();
}
    setTimeout(() => {

mount();
    }, 100);
