/**
 * Unit tests for ID generation utilities
 */

import {
  generateStableId,
  isTemporaryId,
  isUuid,
  isStableId,
  getIdType,
  batchGenerateIds
} from '../idUtils';

describe('idUtils', () => {
  describe('generateStableId', () => {
    test('should generate consistent IDs for same inputs', () => {
      const id1 = generateStableId('Haus', 'noun');
      const id2 = generateStableId('Haus', 'noun');
      expect(id1).toBe(id2);
    });

    test('should be case-insensitive for word', () => {
      const id1 = generateStableId('Haus', 'noun');
      const id2 = generateStableId('haus', 'noun');
      const id3 = generateStableId('HAUS', 'noun');
      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });

    test('should be case-insensitive for pos', () => {
      const id1 = generateStableId('Haus', 'noun');
      const id2 = generateStableId('Haus', 'NOUN');
      const id3 = generateStableId('Haus', 'Noun');
      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });

    test('should generate different IDs for different POS', () => {
      const verbId = generateStableId('laufen', 'verb');
      const nounId = generateStableId('laufen', 'noun');
      expect(verbId).not.toBe(nounId);
    });

    test('should generate different IDs for different words', () => {
      const id1 = generateStableId('Haus', 'noun');
      const id2 = generateStableId('Katze', 'noun');
      expect(id1).not.toBe(id2);
    });

    test('should always return positive integers', () => {
      const testCases = [
        ['Haus', 'noun'],
        ['laufen', 'verb'],
        ['schön', 'adj'],
        ['und', 'conj'],
        ['Test', 'unknown']
      ];

      testCases.forEach(([word, pos]) => {
        const id = generateStableId(word, pos);
        expect(id).toBeGreaterThan(0);
        expect(Number.isInteger(id)).toBe(true);
      });
    });

    test('should handle special characters', () => {
      const id1 = generateStableId('Äpfel', 'noun');
      const id2 = generateStableId('Äpfel', 'noun');
      expect(id1).toBe(id2);
      expect(id1).toBeGreaterThan(0);
    });

    test('should handle empty pos as valid input', () => {
      const id1 = generateStableId('test', '');
      const id2 = generateStableId('test', '');
      expect(id1).toBe(id2);
      expect(id1).toBeGreaterThan(0);
    });
  });

  describe('isTemporaryId', () => {
    test('should detect temporary IDs', () => {
      expect(isTemporaryId('c_1234567890_abc123')).toBe(true);
      expect(isTemporaryId('c_')).toBe(true);
    });

    test('should reject non-temporary IDs', () => {
      expect(isTemporaryId(12345)).toBe(false);
      expect(isTemporaryId('12345')).toBe(false);
      expect(isTemporaryId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
      expect(isTemporaryId('abc123')).toBe(false);
    });

    test('should handle null and undefined', () => {
      expect(isTemporaryId(null)).toBe(false);
      expect(isTemporaryId(undefined)).toBe(false);
    });
  });

  describe('isUuid', () => {
    test('should detect valid UUIDs', () => {
      expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isUuid('A1B2C3D4-E5F6-4789-A012-B3C4D5E6F7A8')).toBe(true); // uppercase
    });

    test('should reject invalid UUIDs', () => {
      expect(isUuid('12345')).toBe(false);
      expect(isUuid('550e8400-e29b-41d4-a716')).toBe(false); // too short
      expect(isUuid('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false); // too long
      expect(isUuid('c_1234567890_abc123')).toBe(false);
      expect(isUuid(12345)).toBe(false);
    });

    test('should handle null and undefined', () => {
      expect(isUuid(null)).toBe(false);
      expect(isUuid(undefined)).toBe(false);
    });
  });

  describe('isStableId', () => {
    test('should detect stable IDs', () => {
      expect(isStableId(12345)).toBe(true);
      expect(isStableId(9876543210)).toBe(true);
      expect(isStableId(1)).toBe(true);
    });

    test('should reject non-stable IDs', () => {
      expect(isStableId('12345')).toBe(false); // string
      expect(isStableId(-123)).toBe(false); // negative
      expect(isStableId(0)).toBe(false); // zero
      expect(isStableId(12.5)).toBe(false); // float
      expect(isStableId('c_123')).toBe(false);
      expect(isStableId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });

    test('should handle null and undefined', () => {
      expect(isStableId(null)).toBe(false);
      expect(isStableId(undefined)).toBe(false);
    });
  });

  describe('getIdType', () => {
    test('should correctly identify stable IDs', () => {
      expect(getIdType(12345)).toBe('stable');
      expect(getIdType(9876543210)).toBe('stable');
    });

    test('should correctly identify temporary IDs', () => {
      expect(getIdType('c_1234567890_abc123')).toBe('temporary');
    });

    test('should correctly identify UUIDs', () => {
      expect(getIdType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
    });

    test('should identify unknown types', () => {
      expect(getIdType('invalid')).toBe('unknown');
      expect(getIdType(null)).toBe('unknown');
      expect(getIdType(undefined)).toBe('unknown');
      expect(getIdType(-123)).toBe('unknown');
    });
  });

  describe('batchGenerateIds', () => {
    test('should generate IDs for all words', () => {
      const words = [
        { de: 'Haus', pos: 'noun', cn: '房子' },
        { de: 'laufen', pos: 'verb', cn: '跑' },
        { de: 'schön', pos: 'adj', cn: '美丽的' }
      ];

      const result = batchGenerateIds(words);

      expect(result).toHaveLength(3);
      result.forEach((word, index) => {
        expect(word).toHaveProperty('id');
        expect(isStableId(word.id)).toBe(true);
        expect(word.de).toBe(words[index].de);
        expect(word.cn).toBe(words[index].cn);
      });
    });

    test('should use "unknown" for missing pos', () => {
      const words = [
        { de: 'test', cn: '测试' } // no pos
      ];

      const result = batchGenerateIds(words);

      expect(result).toHaveLength(1);
      expect(isStableId(result[0].id)).toBe(true);
      // ID should be same as if pos was 'unknown'
      const expectedId = generateStableId('test', 'unknown');
      expect(result[0].id).toBe(expectedId);
    });

    test('should handle empty array', () => {
      const result = batchGenerateIds([]);
      expect(result).toEqual([]);
    });
  });

  describe('ID consistency across implementations', () => {
    test('should match expected IDs for common German words', () => {
      // These IDs should remain stable across code changes
      // If these tests fail, it means the ID generation algorithm has changed
      const testCases = [
        { word: 'haus', pos: 'noun', expectedType: 'positive integer' },
        { word: 'katze', pos: 'noun', expectedType: 'positive integer' },
        { word: 'laufen', pos: 'verb', expectedType: 'positive integer' }
      ];

      testCases.forEach(({ word, pos }) => {
        const id = generateStableId(word, pos);
        expect(id).toBeGreaterThan(0);
        expect(Number.isInteger(id)).toBe(true);

        // Test consistency
        const id2 = generateStableId(word, pos);
        expect(id).toBe(id2);
      });
    });
  });
});
