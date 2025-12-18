// src/logic/constants.js
import { generateStableId } from '../utils/idUtils';

export const LEARNING_STEPS = [1, 10];
export const MIN_EASE_FACTOR = 1.3;
export const MAX_PRIORITY_QUEUE_SIZE = 3;
export const MIN_DECK_SIZE = 5;

export const DEFAULT_WORDS = [
  {
    id: generateStableId('Apfel', 'noun'),
    de: 'Apfel',
    cn: '苹果',
    pos: 'noun',
    gender: 'm',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    proficiency: 0,
    graduated: false,
    lastReview: null,
    example: null
  },
  {
    id: generateStableId('Morgen', 'noun'),
    de: 'Morgen',
    cn: '早上',
    pos: 'noun',
    gender: 'm',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    proficiency: 0,
    graduated: false,
    lastReview: null,
    example: null
  },
  {
    id: generateStableId('Liebe', 'noun'),
    de: 'Liebe',
    cn: '爱',
    pos: 'noun',
    gender: 'f',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    proficiency: 0,
    graduated: false,
    lastReview: null,
    example: null
  },
  {
    id: generateStableId('Katze', 'noun'),
    de: 'Katze',
    cn: '猫',
    pos: 'noun',
    gender: 'f',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    proficiency: 0,
    graduated: false,
    lastReview: null,
    example: null
  },
  {
    id: generateStableId('Hund', 'noun'),
    de: 'Hund',
    cn: '狗',
    pos: 'noun',
    gender: 'm',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    proficiency: 0,
    graduated: false,
    lastReview: null,
    example: null
  },
  {
    id: generateStableId('Haus', 'noun'),
    de: 'Haus',
    cn: '房子',
    pos: 'noun',
    gender: 'n',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    proficiency: 0,
    graduated: false,
    lastReview: null,
    example: null
  },
  {
    id: generateStableId('Wasser', 'noun'),
    de: 'Wasser',
    cn: '水',
    pos: 'noun',
    gender: 'n',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    proficiency: 0,
    graduated: false,
    lastReview: null,
    example: null
  },
];
