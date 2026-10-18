import * as Phaser from 'phaser'

export const SCENE_KEYS = {
    PRELOAD: 'PRELOADER',
    TITLE: 'TITLE',
    GAME: 'GAME',
    WIN: 'WIN'
} as const;

export const ASSET_KEYS = {
    TITLE: 'TITLE',
    CLICK_TO_START: 'CLICK_TO_START',
    CARDS: 'CARDS',
    TABLE: 'TABLE',
    BANNER: 'BANNER',
    WIN: 'WIN',
    PLAY_AGAIN: 'PLAY_AGAIN'
} as const;

export const CARD_WIDTH = 111
export const CARD_HEIGHT = 156

/**
 * Adds a text button that toggles fullscreen. Returns undefined when the browser can't go fullscreen (e.g. iPhone Safari).
 */
export function createFullscreenButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text | undefined {
    if (!scene.sys.game.device.fullscreen.available) {
        return undefined
    }

    // browsers only allow fullscreen from a user gesture, which Phaser requires to be pointerup rather than pointerdown
    return scene.add
        .text(x, y, 'Fullscreen', style)
        .setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.POINTER_UP, () => scene.scale.toggleFullscreen())
}