import type { Edge } from '@xyflow/react';

import type { AppNode, AnalysisNodeData, HoldingSnapshotNodeData } from '@/nodes/types';
import type { HoldingActionsNodeData } from '@/store/holdingActions';
import { supabase } from './supabase';

const CANVAS_STATE_ID = 'default';

export type CanvasState = {
  nodes: AppNode[];
  edges: Edge[];
  snapshots: Record<string, HoldingSnapshotNodeData>;
  actions: Record<string, HoldingActionsNodeData>;
  analyses: Record<string, AnalysisNodeData>;
};

export async function saveCanvasState(state: CanvasState): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase
    .from('canvas_state')
    .upsert({ id: CANVAS_STATE_ID, state, updated_at: new Date().toISOString() });

  if (error) throw error;
}

export async function loadCanvasState(): Promise<CanvasState | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('canvas_state')
    .select('state')
    .eq('id', CANVAS_STATE_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data?.state) return null;

  const state = data.state as CanvasState;
  // Older saved rows predate the `actions` and `analyses` fields.
  return { ...state, actions: state.actions ?? {}, analyses: state.analyses ?? {} };
}
