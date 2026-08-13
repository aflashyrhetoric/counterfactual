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
  type OnConnectEnd,
  Panel,
} from '@xyflow/react';
import { Save } from 'lucide-react';

import '@xyflow/react/dist/style.css';

import { initialNodes, nodeTypes } from './nodes';
import { initialEdges, edgeTypes } from './edges';
import { Button } from './components/ui/button';
import type { AppNode, HoldingSnapshotNode } from './nodes/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { findOpenSpot, getNodeId } from './lib/flow';
import { useHoldingSnapshotStore } from './store/holdingSnapshots';
import { useHoldingActionsStore } from './store/holdingActions';
import { loadCanvasState, saveCanvasState } from './lib/persistence';

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);

  const { getIntersectingNodes, screenToFlowPosition, fitView } = useReactFlow();
  const initHolding = useHoldingSnapshotStore((s) => s.initHolding);
  const removeHolding = useHoldingSnapshotStore((s) => s.removeHolding);
  const loadSnapshots = useHoldingSnapshotStore((s) => s.loadSnapshots);
  const initActions = useHoldingActionsStore((s) => s.initActions);
  const removeActions = useHoldingActionsStore((s) => s.removeActions);
  const loadActions = useHoldingActionsStore((s) => s.loadActions);

  const onNodesDelete = useCallback(
    (deleted: AppNode[]) => {
      for (const node of deleted) {
        if (node.type === 'holding-snapshot') removeHolding(node.id);
        else if (node.type === 'holding-actions') removeActions(node.id);
      }
    },
    [removeHolding, removeActions]
  );

  useEffect(() => {
    let cancelled = false;

    loadCanvasState()
      .then((state) => {
        if (!state || cancelled) return;
        setNodes(state.nodes);
        setEdges(state.edges);
        loadSnapshots(state.snapshots);
        loadActions(state.actions);
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
        actions: useHoldingActionsStore.getState().actions,
      });
      toast.success('Canvas saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save canvas.');
    } finally {
      setSaving(false);
    }
  }, [nodes, edges]);

  const handleLogState = useCallback(() => {
    console.log({
      nodes,
      edges,
      snapshots: useHoldingSnapshotStore.getState().snapshots,
      actions: useHoldingActionsStore.getState().actions,
    });
  }, [nodes, edges]);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((edges) => addEdge(connection, edges)),
    [setEdges]
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (!connectionState.fromHandle || connectionState.toNode) return;
      if (connectionState.fromNode?.type !== 'holding-snapshot') return;

      const sourceId = connectionState.fromHandle.nodeId;
      const sourceData = useHoldingSnapshotStore.getState().snapshots[sourceId];
      if (!sourceData) return;

      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      const origin = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      const position = findOpenSpot(getIntersectingNodes, origin);
      const newId = getNodeId();

      initActions(newId, {
        label: sourceData.label,
        date: sourceData.date,
        holdings: structuredClone(sourceData.holdings),
        settlement_fund: sourceData.settlement_fund,
        marketOpenPrices: sourceData.marketOpenPrices ? structuredClone(sourceData.marketOpenPrices) : null,
      });

      setNodes((nodes) => nodes.concat({ id: newId, type: 'holding-actions', position, data: {} }));
      setEdges((edges) =>
        addEdge({ source: sourceId, target: newId, sourceHandle: null, targetHandle: null }, edges)
      );
    },
    [screenToFlowPosition, getIntersectingNodes, setNodes, setEdges, initActions]
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
      onNodesDelete={onNodesDelete}
      onConnect={onConnect}
      onConnectEnd={onConnectEnd}
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

      <Panel position="top-right">
        <Button variant="outline" onClick={handleLogState}>
          Paste To Console
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
