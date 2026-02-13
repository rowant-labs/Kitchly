import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import kitchenPlugin from './plugin.js';
import { character } from './character.js';

const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('Initializing Kit - AI Kitchen Companion');
  logger.info({ name: character.name }, 'Agent name:');
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  plugins: [kitchenPlugin],
};

const project: Project = {
  agents: [projectAgent],
};

export { character } from './character.js';

export default project;
