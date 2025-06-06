import { Scene, GameObjects } from 'phaser';
import { ASSET_KEYS, SCENE_KEYS } from './Commons';

export class Title extends Scene {
    start: GameObjects.Image;

    constructor() {
        super({ key: SCENE_KEYS.TITLE });
    }

    create() {

        if (!this.sys.game.device.os.desktop) {
            let rotateText: GameObjects.Text
            if (!this.sys.game.scale.isLandscape) {
                rotateText = this.add
                    .text(
                        this.scale.width / 2,
                        100,
                        `Rotate your device and double tap to toggle fullscreen on/off.`,
                        {
                            font: '28px Raleway',
                            color: '#0d0d0d',
                            backgroundColor: '#FFFFEF',
                            padding: { x: 30, y: 20 },
                        }
                    )
                    .setOrigin(0.5).setDepth(20)
            } else if (this.sys.game.scale.isLandscape) {
                rotateText = this.add
                    .text(
                        this.scale.width / 2,
                        100,
                        `Double tap to toggle fullscreen on/off.`,
                        {
                            font: '28px Raleway',
                            color: '#0d0d0d',
                            backgroundColor: '#FFFFEF',
                            padding: { x: 30, y: 20 },
                        }
                    )
                    .setOrigin(0.5).setDepth(20)
            }

            let lastTap = 0
            this.input.on('pointerup', (pointer: { event: { timeStamp: any; }; }) => {
                let currentTime = pointer.event.timeStamp
                let tapLength = currentTime - lastTap
                if (tapLength < 300 && tapLength > 0) {
                    rotateText.setVisible(false)
                    if (this.scale.isFullscreen) {
                        this.scale.stopFullscreen()
                    } else {
                        this.scale.startFullscreen()
                    }
                    lastTap = 0
                } else {
                    lastTap = currentTime
                }
            })
        }

        this.add.image(0, 0, ASSET_KEYS.TITLE).setOrigin(0);
        this.start = this.add.image(this.scale.width / 2, this.scale.height / 2 + 350, ASSET_KEYS.CLICK_TO_START).setInteractive({ useHandCursor: true }).setOrigin(.5)


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
