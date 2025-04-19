import { Scene } from 'phaser';
import { ASSET_KEYS, SCENE_KEYS } from './Commons';

export class Game extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    msg_text: Phaser.GameObjects.Text;

    constructor() {
        super({ key: SCENE_KEYS.GAME });
    }

    create() {
        this.add.image(0, 0, ASSET_KEYS.TABLE).setOrigin(0)
        this.add.image(0, 0, ASSET_KEYS.CARDS, 1).setOrigin(0)

    }
}
