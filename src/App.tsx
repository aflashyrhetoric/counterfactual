import { useCallback, useEffect, useState } from 'react';
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
import { Save } from 'lucide-react';

import '@xyflow/react/dist/style.css';

import { initialNodes, nodeTypes } from './nodes';
import { initialEdges, edgeTypes } from './edges';
import { Button } from './components/ui/button';
import type { HoldingSnapshotNode } from './nodes/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { findOpenSpot, getNodeId } from './lib/flow';
import { useHoldingSnapshotStore } from './store/holdingSnapshots';
import { loadCanvasState, saveCanvasState } from './lib/persistence';

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);

  const { getIntersectingNodes, screenToFlowPosition, fitView } = useReactFlow();
  const initHolding = useHoldingSnapshotStore((s) => s.initHolding);
  const loadSnapshots = useHoldingSnapshotStore((s) => s.loadSnapshots);

  useEffect(() => {
    let cancelled = false;

    loadCanvasState()
      .then((state) => {
        if (!state || cancelled) return;
        setNodes(state.nodes);
        setEdges(state.edges);
        loadSnapshots(state.snapshots);
        requestAnimationFrame(() => fitView({ maxZoom: 1 }));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load saved canvas.'));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveCanvasState({
        nodes,
        edges,
        snapshots: useHoldingSnapshotStore.getState().snapshots,
      });
      toast.success('Canvas saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save canvas.');
    } finally {
      setSaving(false);
    }
  }, [nodes, edges]);

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
    const id = getNodeId();

    initHolding(id, {
      label: 'Holding Snapshot',
      date: format(new Date(), 'yyyy-MM-dd'),
    });

    const newNode: HoldingSnapshotNode = {
      id,
      type: 'holding-snapshot',
      position,
      data: {},
    };

    setNodes((nodes) => nodes.concat(newNode));
    toast.success("Holding node added.");
  }

  // const [addActionModalOpen]

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      edges={edges}
      edgeTypes={edgeTypes}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onConnectEnd={useCallback(
        (event, connectionState) => {
          toast.success("Connection made!");
          console.log({
            event, connectionState
          })
        },
        []
      )}
      fitView
      fitViewOptions={{ maxZoom: 1 }}
      panOnScroll
      selectionOnDrag
      panOnDrag={false}
    >
      <Panel position="top-left" className="flex gap-2">
        <Button onClick={addHoldingSnapshotNode}>
          Add Holding
        </Button>
        <Button variant="outline" onClick={handleSave} disabled={saving}>
          <Save className={saving ? 'animate-pulse' : undefined} />
          {saving ? 'Saving…' : 'Save'}
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
