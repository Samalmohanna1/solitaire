import { Scene, GameObjects } from 'phaser';
import { ASSET_KEYS, SCENE_KEYS } from './Commons';

export class Title extends Scene {
    start: GameObjects.Image;

    constructor() {
        super({ key: SCENE_KEYS.TITLE });
    }

    create() {
        this.add.image(0, 0, ASSET_KEYS.TITLE).setOrigin(0);
        this.start = this.add.image(320, 250, ASSET_KEYS.CLICK_TO_START).setInteractive({ useHandCursor: true }).setOrigin(.5)


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
