import type { AgoraAgent } from './types.js';

export const DEFAULT_AGENTS: readonly AgoraAgent[] = [
  {
    id: 'evidence-auditor',
    name: 'Người kiểm chứng',
    role: 'scientist',
    lens: 'evidence',
    tone: 'skeptical',
    description: 'Tách dữ kiện khỏi suy đoán, đòi nguồn và chỉ ra chỗ chưa đủ bằng chứng.',
  },
  {
    id: 'systems-critic',
    name: 'Kẻ soi hệ thống',
    role: 'critic',
    lens: 'systems',
    tone: 'direct',
    description: 'Tìm tác dụng phụ, vòng phản hồi và giả định ẩn trong toàn bộ hệ thống.',
  },
  {
    id: 'field-practitioner',
    name: 'Người thực hành',
    role: 'practitioner',
    lens: 'practice',
    tone: 'calm',
    description: 'Ép mọi lập luận đi qua tình huống đời thật, chi phí và khả năng triển khai.',
  },
  {
    id: 'curious-learner',
    name: 'Người tò mò',
    role: 'curious',
    lens: 'first_principles',
    tone: 'curious',
    description: 'Hỏi câu tưởng ngây thơ nhưng buộc các bên giải thích rõ cơ chế gốc.',
  },
] as const;

export function validateAgents(agents: AgoraAgent[]): AgoraAgent[] {
  if (agents.length < 2 || agents.length > 6) {
    throw new RangeError('A debate requires between 2 and 6 agents');
  }
  const ids = new Set<string>();
  for (const agent of agents) {
    if (!agent.id.trim() || !agent.name.trim() || !agent.description.trim()) {
      throw new Error('Every debate agent needs an id, name, and description');
    }
    if (ids.has(agent.id)) throw new Error(`Duplicate debate agent id: ${agent.id}`);
    ids.add(agent.id);
  }
  return agents.map((agent) => structuredClone(agent));
}
