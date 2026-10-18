import { Card } from './card';
import { CARD_SUIT, CardValue } from './common';
import { shuffleArray } from './utils';

export class Deck {
    #cards: Card[];
    #drawPile: Card[];
    #discardPile: Card[];

    constructor() {
        this.#cards = [];
        this.#drawPile = [];
        this.#discardPile = [];
        this.#createDeck();
        this.reset();
    }

    get cards(): Card[] {
        return this.#cards;
    }

    get drawPile(): Card[] {
        return this.#drawPile;
    }

    get discardPile(): Card[] {
        return this.#discardPile;
    }

    public draw(): Card | undefined {
        return this.#drawPile.shift();
    }

    public shuffle(): void {
        shuffleArray(this.#drawPile);
    }

    public shuffleInDiscardPile(): void {
        this.#discardPile.forEach((card) => {
            card.flip();
            this.#drawPile.push(card);
        });
        this.#discardPile = [];
    }

    public reset(): void {
        this.#discardPile = [];
        // deal fresh face down cards, since cards from a previous game may have been flipped
        this.#drawPile = this.#cards.map((card) => new Card(card.suit, card.value));
        this.shuffle();
    }

    /**
     * Replaces the draw and discard piles with previously saved ones, used when undoing a move.
     */
    public restore(drawPile: Card[], discardPile: Card[]): void {
        this.#drawPile = drawPile;
        this.#discardPile = discardPile;
    }

    #createDeck(): void {
        Object.values(CARD_SUIT).forEach((suit) => {
            for (let i = 1; i < 14; i += 1) {
                this.#cards.push(new Card(suit, i as CardValue));
            }
        });
    }
}