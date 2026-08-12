import type { Edge } from '@xyflow/react';

import type { AppNode, HoldingSnapshotNodeData } from '@/nodes/types';
import { supabase } from './supabase';

const CANVAS_STATE_ID = 'default';

export type CanvasState = {
  nodes: AppNode[];
  edges: Edge[];
  snapshots: Record<string, HoldingSnapshotNodeData>;
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
  return (data?.state as CanvasState | undefined) ?? null;
}
