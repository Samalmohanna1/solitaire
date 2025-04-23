import { Scene, GameObjects } from 'phaser';
import { ASSET_KEYS, SCENE_KEYS } from './Commons';

export class Win extends Scene {
    start: GameObjects.Image;

    constructor() {
        super({ key: SCENE_KEYS.WIN });
    }

    create() {
        this.cameras.main.fadeIn(1000)
        this.add.image(0, 0, ASSET_KEYS.WIN).setOrigin(0);
        this.start = this.add.image(240, this.scale.height / 2 + 200, ASSET_KEYS.PLAY_AGAIN).setInteractive({ useHandCursor: true }).setOrigin(0, .5)


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
