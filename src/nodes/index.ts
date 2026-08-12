import type { NodeTypes } from '@xyflow/react';

import { PositionLoggerNode } from './PositionLoggerNode';
import { HoldingSnapshot } from './HoldingSnapshot';
import { HoldingActions } from './HoldingActions';
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
  'holding-actions': HoldingActions,
  // Add any of your custom nodes here!
} satisfies NodeTypes;
