import type { NodeTypes } from '@xyflow/react';

import { PositionLoggerNode } from './PositionLoggerNode';
import { HoldingSnapshot } from './HoldingSnapshot';
import { HoldingActions } from './HoldingActions';
import { AppNode } from './types';

export const initialNodes: AppNode[] = [];

export const nodeTypes = {
  'position-logger': PositionLoggerNode,
  'holding-snapshot': HoldingSnapshot,
  'holding-actions': HoldingActions,
  // Add any of your custom nodes here!
} satisfies NodeTypes;
