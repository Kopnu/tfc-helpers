// Recipes are kept here intentionally: add or correct alloys without touching UI code.
// Source used for initial data: TFC:TNG wiki, "Alloys" page.
export const alloys = [
  {
    id: 'bismuth-bronze',
    ingredients: [
      { id: 'zinc', min: 20, max: 30 },
      { id: 'copper', min: 50, max: 65 },
      { id: 'bismuth', min: 10, max: 20 }
    ]
  },
  {
    id: 'black-bronze',
    ingredients: [
      { id: 'silver', min: 10, max: 25 },
      { id: 'gold', min: 10, max: 25 },
      { id: 'copper', min: 50, max: 70 }
    ]
  },
  {
    id: 'bronze',
    ingredients: [
      { id: 'tin', min: 8, max: 12 },
      { id: 'copper', min: 88, max: 92 }
    ]
  },
  {
    id: 'brass',
    ingredients: [
      { id: 'zinc', min: 8, max: 12 },
      { id: 'copper', min: 88, max: 92 }
    ]
  },
  {
    id: 'rose-gold',
    ingredients: [
      { id: 'copper', min: 15, max: 30 },
      { id: 'gold', min: 70, max: 85 }
    ]
  },
  {
    id: 'sterling-silver',
    ingredients: [
      { id: 'copper', min: 20, max: 40 },
      { id: 'silver', min: 60, max: 80 }
    ]
  },
  {
    id: 'weak-steel',
    ingredients: [
      { id: 'steel', min: 50, max: 70 },
      { id: 'nickel', min: 15, max: 25 },
      { id: 'black-bronze', min: 15, max: 25 }
    ]
  },
  {
    id: 'weak-blue-steel',
    ingredients: [
      { id: 'black-steel', min: 50, max: 55 },
      { id: 'steel', min: 20, max: 25 },
      { id: 'bismuth-bronze', min: 10, max: 15 },
      { id: 'sterling-silver', min: 10, max: 15 }
    ]
  },
  {
    id: 'weak-red-steel',
    ingredients: [
      { id: 'black-steel', min: 50, max: 55 },
      { id: 'steel', min: 20, max: 25 },
      { id: 'brass', min: 10, max: 15 },
      { id: 'rose-gold', min: 10, max: 15 }
    ]
  }
]
