import { CanvasShader } from './voxel/CanvasShader';
import { ShaderCharacter } from './voxel/ShaderCharacter';

export async function mount() {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        throw new Error("Canvas element not found");
    }

    canvas.width = 800;
    canvas.height = 600;

    // new Engine(canvas);

    let lastFrameTime = performance.now();
    let startTime = performance.now();
    let framesPerSecond = 0;

    const shader = new CanvasShader(canvas);

    const blocks = await shader.init();
    const character = new ShaderCharacter(blocks);

    // trap cursor
    canvas.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    // start an animation loop
    function animate() {
        const deltaTime = performance.now() - lastFrameTime;
        lastFrameTime = performance.now();
        const timeSinceStart = (performance.now() - startTime) / 1000;

        if (timeSinceStart > 1) {
            character.update(deltaTime);
        }

        shader.render(character);
        requestAnimationFrame(animate);

        framesPerSecond = 1000 / deltaTime;
    }
    animate();
}
