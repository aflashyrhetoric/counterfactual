import type { NodeTypes } from '@xyflow/react';

import { PositionLoggerNode } from './PositionLoggerNode';
import { HoldingSnapshot } from './HoldingSnapshot';
import { AppNode } from './types';
import { DEMO_HOLDING_SNAPSHOT_ID } from '@/store/holdingSnapshots';

export const initialNodes: AppNode[] = [
  {
    id: DEMO_HOLDING_SNAPSHOT_ID,
    type: 'holding-snapshot',
    position: { x: 0, y: 0 },
    data: {},
  },
];

export const nodeTypes = {
  'position-logger': PositionLoggerNode,
  'holding-snapshot': HoldingSnapshot,
  // Add any of your custom nodes here!
} satisfies NodeTypes;
