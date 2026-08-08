import { Handle, Position, type NodeProps } from '@xyflow/react';

import { type HoldingSnapshotNode } from './types';

export function HoldingSnapshot({ data }: NodeProps<HoldingSnapshotNode>) {
  return (
    <div className="react-flow__node-default h-[100px]">
      <span>
        <strong>Holding Snapshot</strong>
      </span>
      <input type="text" defaultValue={data.label} />

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
