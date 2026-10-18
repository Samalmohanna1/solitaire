import { Scene, GameObjects } from 'phaser';
import { ASSET_KEYS, SCENE_KEYS, createFullscreenButton } from './Commons';

const labelStyle = {
    font: '28px Raleway',
    color: '#0d0d0d',
    backgroundColor: '#FFFFEF',
    padding: { x: 30, y: 20 },
}

export class Title extends Scene {
    start: GameObjects.Image;

    constructor() {
        super({ key: SCENE_KEYS.TITLE });
    }

    create() {

        if (!this.sys.game.device.os.desktop && !this.sys.game.scale.isLandscape) {
            this.add
                .text(this.scale.width / 2, 100, 'Rotate your device to landscape for the best view.', labelStyle)
                .setOrigin(0.5).setDepth(20)
        }

        this.add.image(0, 0, ASSET_KEYS.TITLE).setOrigin(0);
        this.start = this.add.image(this.scale.width / 2, this.scale.height / 2 + 350, ASSET_KEYS.CLICK_TO_START).setInteractive({ useHandCursor: true }).setOrigin(.5)
        createFullscreenButton(this, this.scale.width - 100, this.scale.height - 100, labelStyle)?.setOrigin(1)


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
