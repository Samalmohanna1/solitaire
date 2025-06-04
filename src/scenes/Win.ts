import { Scene, GameObjects } from 'phaser';
import { ASSET_KEYS, SCENE_KEYS } from './Commons';

const textStyle = { font: '40px Raleway', fontStyle: 'bold', color: '#FFFEFF' }

export class Win extends Scene {
    start: GameObjects.Image;
    moves: number;
    timer: string;
    score: number;

    constructor() {
        super({ key: SCENE_KEYS.WIN });
    }

    init(data: { moves: number, time: string, score: number }) {
        this.moves = data.moves
        this.timer = data.time
        this.score = data.score
    }

    create() {
        this.cameras.main.fadeIn(1000)
        this.add.image(0, 0, ASSET_KEYS.WIN).setOrigin(0);
        this.start = this.add.image(300, this.scale.height / 2 + 280, ASSET_KEYS.PLAY_AGAIN).setInteractive({ useHandCursor: true }).setOrigin(0, .5)


        this.add.text(215, this.scale.height / 2 - 20, 'Moves:     -----------------------',
            textStyle)
        this.add.text(1025, this.scale.height / 2 - 20, `${this.moves}`,
            textStyle).setOrigin(1, 0)

        this.add.text(215, this.scale.height / 2 + 40, `Score:       -----------------------`, textStyle)
        this.add.text(1025, this.scale.height / 2 + 40, `${this.score}`,
            textStyle).setOrigin(1, 0)

        this.add.text(215, this.scale.height / 2 + 100, `Time:        -----------------------`, textStyle)
        this.add.text(1025, this.scale.height / 2 + 100, `${this.timer}`,
            textStyle).setOrigin(1, 0)


        this.start.on('pointerdown', () => {
            this.cameras.main.fadeOut(1000, 0, 0, 0, (camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
                if (progress !== 1) {
                    return
                }
                this.scene.start(SCENE_KEYS.GAME);
            })

        });
    }
}
