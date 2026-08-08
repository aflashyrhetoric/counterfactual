import { nanoid } from 'nanoid';
import type { Rect } from '@xyflow/react';

// Fallback dimensions for nodes that haven't been measured (rendered) yet.
export const DEFAULT_NODE_WIDTH = 150;
export const DEFAULT_NODE_HEIGHT = 100;
// Minimum breathing room to leave between a new node and its neighbors.
export const NODE_SPACING = 40;
// Distance between candidate spots as we spiral outward.
export const SPIRAL_STEP = 60;

export function getNodeId(): string {
  return `node_${nanoid()}`;
}

type GetIntersectingNodes = (rect: Rect) => unknown[];

/**
 * Walks a square spiral outward from `origin`, in flow coordinates, and
 * returns the first spot where a `width` x `height` node (padded by
 * `NODE_SPACING`) doesn't overlap any existing node.
 */
export function findOpenSpot(
  getIntersectingNodes: GetIntersectingNodes,
  origin: { x: number; y: number },
  width = DEFAULT_NODE_WIDTH,
  height = DEFAULT_NODE_HEIGHT
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let dx = 1;
  let dy = 0;
  let segmentLength = 1;
  let segmentPassed = 0;

  for (let i = 0; i < 500; i++) {
    const candidate = { x: origin.x + x * SPIRAL_STEP, y: origin.y + y * SPIRAL_STEP };
    const rect: Rect = {
      x: candidate.x - NODE_SPACING / 2,
      y: candidate.y - NODE_SPACING / 2,
      width: width + NODE_SPACING,
      height: height + NODE_SPACING,
    };

    if (getIntersectingNodes(rect).length === 0) {
      return candidate;
    }

    x += dx;
    y += dy;
    segmentPassed += 1;

    if (segmentPassed === segmentLength) {
      segmentPassed = 0;
      [dx, dy] = [-dy, dx]; // rotate 90°
      if (dy === 0) segmentLength += 1;
    }
  }

  return origin;
}
