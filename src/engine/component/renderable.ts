import { addComponent, hasComponent, IComponent } from "bitecs";

import { maxEntities } from "../config.common";
import { SetActiveCameraMessage, SetActiveSceneMessage, WorkerMessageType } from "../WorkerMessage";
import { traverse } from "./transform";
import { GameState, World } from "../GameTypes";
import { createObjectBufferView } from "../allocator/ObjectBufferView";

export interface Renderable extends IComponent {
  resourceId: Uint32Array;
  interpolate: Uint8Array;
  visible: Uint8Array;
}

export const Renderable: Renderable = createObjectBufferView(
  {
    resourceId: [Uint32Array, maxEntities],
    interpolate: [Uint8Array, maxEntities],
    visible: [Uint8Array, maxEntities],
  },
  ArrayBuffer
);

export function addRenderableComponent({ world, renderPort }: GameState, eid: number, resourceId: number) {
  addComponent(world, Renderable, eid);
  Renderable.interpolate[eid] = 1;
  Renderable.resourceId[eid] = resourceId;
  renderPort.postMessage({ type: WorkerMessageType.AddRenderable, eid, resourceId });
}

export function setActiveScene(state: GameState, eid: number, resourceId: number) {
  state.renderPort.postMessage({
    type: WorkerMessageType.SetActiveScene,
    eid,
    resourceId,
  } as SetActiveSceneMessage);
  state.scene = eid;
}

export function setActiveCamera(state: GameState, eid: number) {
  state.renderPort.postMessage({
    type: WorkerMessageType.SetActiveCamera,
    eid,
  } as SetActiveCameraMessage);
  state.camera = eid;
}

export function resetVisible(world: World, rootEid: number) {
  Renderable.visible.fill(0);

  traverse(rootEid, (eid) => {
    if (hasComponent(world, Renderable, eid)) {
      Renderable.visible[eid] = 1;
    }
  });
}

export function RenderableVisibilitySystem({ world, scene }: GameState) {
  resetVisible(world, scene);
}
