import type { Node, BuiltInNode } from '@xyflow/react';

export type PositionLoggerNode = Node<{ label: string }, 'position-logger'>;
export type HoldingSnapshotNode = Node<{ label: string }, 'holding-snapshot'>;
export type AppNode = BuiltInNode | PositionLoggerNode | HoldingSnapshotNode;
