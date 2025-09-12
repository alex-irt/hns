

export function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function randomLetters(count: number) {
    let result = '';

    for (let i = 0; i < count; i++) {
        result += String.fromCharCode(97 + Math.floor(Math.random() * 26));
    }

    return result;
}

export function randomFromArray<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}
