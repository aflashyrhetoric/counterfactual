import { useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnConnect,
  Panel,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import { initialNodes, nodeTypes } from './nodes';
import { initialEdges, edgeTypes } from './edges';
import { Button } from './components/ui/button';
import type { HoldingSnapshotNode } from './nodes/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { findOpenSpot, getNodeId } from './lib/flow';

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const { getIntersectingNodes, screenToFlowPosition } = useReactFlow();

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((edges) => addEdge(connection, edges)),
    [setEdges]
  );

  function addHoldingSnapshotNode() {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const position = findOpenSpot(getIntersectingNodes, center);

    const newNode: HoldingSnapshotNode = {
      id: getNodeId(),
      type: 'holding-snapshot',
      position,
      data: {
        label: 'Holding Snapshot',
        date: format(new Date(), 'yyyy-MM-dd'),
        holdings: [],
        settlement_fund: 0,
      },
    };

    setNodes((nodes) => nodes.concat(newNode));
    toast.success("Holding node added.");
  }

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      edges={edges}
      edgeTypes={edgeTypes}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
      panOnScroll
      selectionOnDrag
      panOnDrag={false}
    >
      <Panel position="top-left">
        <Button onClick={addHoldingSnapshotNode}>
          Add Holding
        </Button>
      </Panel>

      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
