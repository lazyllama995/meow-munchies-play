// Clean chapter paintings; animated atmosphere is separate. No animal sprites.
export const GAMEPLAY_SCENES = [
  {
    "chapter": 1,
    "title": "Morning at Miso's",
    "background": "assets/world/region-01/gameplay/01-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/01-foreground.webp",
    "ambient": []
  },
  {
    "chapter": 2,
    "title": "The Flower Courtyard",
    "background": "assets/world/region-01/gameplay/02-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/02-foreground-v2.webp",
    "ambient": []
  },
  {
    "chapter": 3,
    "title": "Bookshop Naps",
    "background": "assets/world/region-01/gameplay/03-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/03-foreground.webp",
    "ambient": []
  },
  {
    "chapter": 4,
    "title": "Riverside Market",
    "background": "assets/world/region-01/gameplay/04-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/04-foreground.webp",
    "ambient": []
  },
  {
    "chapter": 5,
    "title": "Craft Room Tangles",
    "background": "assets/world/region-01/gameplay/05-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/05-foreground-v2.webp",
    "ambient": []
  },
  {
    "chapter": 6,
    "title": "Orchard Picnic",
    "background": "assets/world/region-01/gameplay/06-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/06-foreground.webp",
    "ambient": [
      {
        "name": "globo-pera",
        "src": "assets/world/region-01/gameplay/globo-pera.webp",
        "x": 10,
        "y": 19,
        "width": 24.038338658146966,
        "pivot": [
          0.50159,
          0.49801
        ],
        "motion": "float"
      },
      {
        "name": "globo-melocoton",
        "src": "assets/world/region-01/gameplay/globo-melocoton.webp",
        "x": 90,
        "y": 20,
        "width": 19.04617253948967,
        "pivot": [
          0.5004,
          0.50439
        ],
        "motion": "float"
      }
    ]
  },
  {
    "chapter": 7,
    "title": "Clover Garden",
    "background": "assets/world/region-01/gameplay/07-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/07-foreground.webp",
    "ambient": []
  },
  {
    "chapter": 8,
    "title": "The Old Mill Bakery",
    "background": "assets/world/region-01/gameplay/08-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/08-foreground.webp",
    "ambient": [
      {
        "name": "molino-aspas",
        "src": "assets/world/region-01/gameplay/molino-aspas.webp",
        "x": 87.7,
        "y": 61.2,
        "width": 32.586021505376344,
        "pivot": [
          0.5,
          0.515
        ],
        "motion": "rotate"
      }
    ]
  },
  {
    "chapter": 9,
    "title": "Lantern Lane",
    "background": "assets/world/region-01/gameplay/09-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/09-foreground.webp",
    "ambient": []
  },
  {
    "chapter": 10,
    "title": "The Grand Tasting Party",
    "background": "assets/world/region-01/gameplay/10-background-v2.webp",
    "foreground": "assets/world/region-01/gameplay/10-foreground.webp",
    "ambient": []
  }
];

export function gameplayScene(levelIndex, campaign) {
  return campaign && levelIndex >= 0 && levelIndex < 100 ? GAMEPLAY_SCENES[Math.floor(levelIndex / 10)] : null;
}
