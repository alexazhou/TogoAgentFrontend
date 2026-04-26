import { describe, expect, it } from 'vitest';
import { normalizeWsEventPayload } from '../eventNormalizer';

describe('normalizeWsEventPayload', () => {
  it('normalizes room_status with current_turn_agent_id', () => {
    const event = normalizeWsEventPayload({
      event: 'room_status',
      gt_room: {
        id: 11,
        team_id: 7,
        name: 'general',
      },
      state: 'SCHEDULING',
      need_scheduling: true,
      current_turn_agent_id: 42,
    });

    expect(event).toEqual({
      type: 'room_status',
      teamId: 7,
      roomId: 11,
      state: 'scheduling',
      needScheduler: true,
      currentTurnAgentId: 42,
    });
  });
});
