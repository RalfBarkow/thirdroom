import { addComponent, defineQuery, exitQuery } from "bitecs";

import { editorNameChangedQueue } from "../editor/editor.game";
import { GameState, World } from "../GameTypes";

/**
 * The Name component is used for labeling entities. It's particularly helpful for labeling entities in the editor.
 */
export const Name: Map<number, string> = new Map();

export function addNameComponent(world: World, eid: number, name: string) {
  addComponent(world, Name, eid);
  Name.set(eid, name);
}

export function setName(eid: number, name: string) {
  editorNameChangedQueue.push([eid, name]);
  Name.set(eid, name);
}

export const nameQuery = defineQuery([Name]);
const nameExitQuery = exitQuery(nameQuery);

export function NameSystem(ctx: GameState) {
  const removed = nameExitQuery(ctx.world);

  for (let i = 0; i < removed.length; i++) {
    const eid = removed[i];
    Name.delete(eid);
  }
}
