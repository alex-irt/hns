import { randomLetters } from "./helpers/random";
import { ShaderCharacter } from "./voxel/ShaderCharacter";

export class Multiplayer {
    socket!: WebSocket;
    myId: string;

    lastUpdateSent: number = 0;
    updateInterval: number = 50;

    players: Record<string, {
        position: number[],
        rotation: number[],
        color: number[],
        id: string,
        lastUpdate: number
    }> = {};

    constructor() {
        this.myId = randomLetters(32);

        this.connect();
    }

    connect() {
        this.socket = new WebSocket('wss://relay.js13kgames.com/color-cat');

        this.socket.onopen = () => {
            console.log('Connected to socket');
        };

        this.socket.onmessage = (event) => {
            let data: any;
            try {
                data = JSON.parse(event.data);

                this.receive(data);
            } catch (e) {
                if (e instanceof SyntaxError) {
                    console.error('Invalid JSON', event.data);
                } else {
                    console.error(e);
                }
            }
        }

        this.socket.onclose = () => {
            console.error('Connection closed');
            
            setTimeout(() => this.connect(), 500);
        }

        this.socket.onerror = (e) => {
            console.error(e);

            setTimeout(() => this.connect(), 500);
            // if closed, reconnect
            // if (this.socket && this.socket.readyState === WebSocket.CLOSED) {
            //     setTimeout(() => this.connect(), 500);
            // }
        }
    }

    receive(data: { type: string } & any) {
        if (data.type === 'update') {
            const updateData = data as {
                id: string,
                position: number[],
                rotation: number[],
                color: number[],
            };

            this.players[updateData.id] = {
                ...data,
                lastUpdate: new Date().getTime()
            };
        }
    }

    update(character: ShaderCharacter) {
        if (new Date().getTime() - this.lastUpdateSent < this.updateInterval) {
            return;
        }

        if (this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        this.socket.send(JSON.stringify({
            type: 'update',
            id: this.myId,
            position: character.position.toArray(),
            rotation: [character.rotation.x, character.rotation.y, character.rotation.z, character.rotation.w],
            color: character.color,
        }));

        console.log(character.position.toArray());

        this.lastUpdateSent = new Date().getTime();

        // remove players that haven't been updated in the last 10 seconds
        const now = new Date().getTime();
        for (const id in this.players) {
            if (now - this.players[id].lastUpdate > 10000) {
                delete this.players[id];
            }
        }
    }
}