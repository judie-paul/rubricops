import { taskSchema, type TaskInput } from './validation';

/** Local exports only. Network acquisition is an explicit separate step. */
export function normalize(
  rows: unknown[],
  format: 'normalized' | 'hh' | 'arena',
): TaskInput[] {
  if (!rows.length || rows.length > 500)
    throw new Error('Import between 1 and 500 records.');
  const result = rows.map((row, index) => {
    try {
      const r = row as Record<string, unknown>;
      if (!r || typeof r !== 'object') throw new Error('Expected an object');
      if (format === 'normalized') return taskSchema.parse(r);
      if (format === 'hh') {
        if (typeof r.chosen !== 'string')
          throw new Error('Expected chosen transcript');
        const split = r.chosen.lastIndexOf('\n\nAssistant:');
        if (split < 0) throw new Error('Missing final Assistant turn');
        return taskSchema.parse({
          externalId: r.id,
          prompt: r.chosen.slice(0, split).trim(),
          response: r.chosen.slice(split + 12).trim(),
          source: 'Anthropic/hh-rlhf',
        });
      }
      const messages = r.conversation_a;
      if (!Array.isArray(messages)) throw new Error('Expected conversation_a');
      const assistantIndex = messages.findIndex((m) => m.role === 'assistant');
      if (assistantIndex < 1)
        throw new Error('Expected a user turn followed by an assistant turn');
      return taskSchema.parse({
        externalId: r.question_id,
        prompt: messages
          .slice(0, assistantIndex)
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n'),
        response: messages[assistantIndex].content,
        source: 'lmsys/chatbot_arena_conversations',
      });
    } catch (e) {
      throw new Error(
        `Record ${index + 1}: ${e instanceof Error ? e.message : 'invalid record'}`,
      );
    }
  });
  if (new Set(result.map((r) => r.externalId)).size !== result.length)
    throw new Error('Duplicate external IDs in import.');
  return result;
}
