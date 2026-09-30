import { describe, expect, it } from 'vitest';
import {
  agreementByRaterPair,
  cohensKappa,
  median,
  rate,
  sampled,
} from '../src/lib/metrics';
import { normalize } from '../src/lib/ingest';
import { rubricSchema, validateScores } from '../src/lib/validation';
import hh from '../fixtures/hh.json';
import arena from '../fixtures/arena.json';
import normal from '../fixtures/import.json';
describe('agreement metrics', () => {
  it('matches hand-calculated agreement beyond chance', () => {
    // observed .75; expected .5 => kappa .5
    expect(
      cohensKappa([
        [1, 1],
        [1, 1],
        [2, 2],
        [2, 1],
      ]),
    ).toBeCloseTo(0.5);
  });
  it('reports perfect agreement with varied classes', () =>
    expect(
      cohensKappa([
        [1, 1],
        [2, 2],
      ]),
    ).toBe(1));
  it('can report negative agreement', () =>
    expect(
      cohensKappa([
        [1, 2],
        [2, 1],
      ]),
    ).toBe(-1));
  it('does not invent agreement for empty or constant pairs', () => {
    expect(cohensKappa([])).toBeNull();
    expect(
      cohensKappa([
        [3, 3],
        [3, 3],
      ]),
    ).toBeNull();
  });
  it('handles median, empty samples, and zero denominator', () => {
    expect(median([7, 1, 4, 9])).toBe(5.5);
    expect(median([8, 1, 4])).toBe(4);
    expect(median([])).toBeNull();
    expect(rate(0, 0)).toBeNull();
    expect(rate(2, 8)).toBe(0.25);
  });
  it('selects an order-independent deterministic sample', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `task-${i}`);
    expect(ids.filter((id) => sampled(id)).length).toBeGreaterThan(200);
    expect(ids.filter((id) => sampled(id)).length).toBeLessThan(300);
    expect(ids.map((id) => sampled(id))).toEqual(
      [...ids]
        .reverse()
        .map((id) => sampled(id))
        .reverse(),
    );
  });
});
describe('ingestion', () => {
  it('normalizes each supported export shape', () => {
    expect(normalize(normal, 'normalized')).toEqual(normal);
    expect(normalize(hh, 'hh')[0].response).toBe(
      'Group notes by topic and give each group a clear title.',
    );
    expect(normalize(arena, 'arena')[0].prompt).toBe(
      'user: What is a unit test?',
    );
  });
  it('rejects empty, oversized, duplicate and malformed batches', () => {
    expect(() => normalize([], 'normalized')).toThrow();
    expect(() => normalize(Array(501).fill(normal[0]), 'normalized')).toThrow();
    expect(() => normalize([normal[0], normal[0]], 'normalized')).toThrow(
      'Duplicate',
    );
    expect(() => normalize([{}, normal[0]], 'normalized')).toThrow('Record 1');
    expect(() => normalize([{ chosen: 'No assistant turn' }], 'hh')).toThrow();
    expect(() =>
      normalize([{ question_id: 'x', conversation_a: [] }], 'arena'),
    ).toThrow();
  });
});
describe('rubrics and scoring', () => {
  const criteria = [
    { id: 'accuracy', name: 'Accuracy', description: 'Correct claims' },
  ];
  it('requires every rubric criterion, no additional criteria and integer scores', () => {
    expect(() => validateScores({ accuracy: 4 }, criteria)).not.toThrow();
    for (const scores of [
      {},
      { accuracy: 6 },
      { accuracy: 1.5 },
      { accuracy: 3, unknown: 2 },
    ])
      expect(() =>
        validateScores(scores as Record<string, number>, criteria),
      ).toThrow();
  });
  it('rejects ambiguous duplicate criterion IDs', () =>
    expect(
      rubricSchema.safeParse({
        name: 'Quality',
        criteria: [...criteria, ...criteria],
      }).success,
    ).toBe(false));
});

describe('stable evaluator identities', () => {
  const evaluation = (userId: string, value: number) => ({
    userId,
    scores: { accuracy: value },
  });
  it('is invariant to submission order and does not pool different raters', () => {
    const tasks = [
      [evaluation('a', 1), evaluation('b', 2)],
      [evaluation('a', 1), evaluation('b', 2)],
      [evaluation('b', 1), evaluation('a', 2)],
      [evaluation('a', 5), evaluation('c', 5)],
    ];
    const result = agreementByRaterPair(tasks, 'accuracy');
    expect(result).toHaveLength(2);
    expect(result[0].raterIds).toEqual(['a', 'b']);
    expect(result[0].pairs).toBe(3);
    expect(result[0].kappa).toBeCloseTo(-0.8);
    expect(result[1].raterIds).toEqual(['a', 'c']);
    expect(result[1].kappa).toBeNull();
    expect(
      agreementByRaterPair(
        tasks.map((t) => [...t].reverse()),
        'accuracy',
      ),
    ).toEqual(result);
  });
  it('does not produce an agreement row for unpaired or repeated evaluators', () => {
    expect(
      agreementByRaterPair(
        [[], [evaluation('a', 1)], [evaluation('a', 1), evaluation('a', 2)]],
        'accuracy',
      ),
    ).toEqual([]);
  });
});
