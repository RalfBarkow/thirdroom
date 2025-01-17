import { Room, RoomBeingCreated } from "@thirdroom/hydrogen-view-sdk";
import { useLocation, useMatch } from "react-router-dom";

import { useHydrogen } from "./useHydrogen";
import { useObservableMap } from "./useObservableMap";
import { useHomeWorld } from "./useHomeWorld";

export function useWorld(): [string | undefined, Room | RoomBeingCreated | undefined, string | null] {
  const { session } = useHydrogen(true);
  const location = useLocation();
  const homeMatch = useMatch({ path: "/", end: true });
  const isHome = homeMatch !== null;
  const worldMatch = useMatch({ path: "world/:worldId/*" });
  const [alias, hashSearch] = location.hash.split("?");
  const reloadId = new URLSearchParams(location.search || hashSearch).get("reload");
  const worldId = worldMatch && worldMatch.params["worldId"];
  const worldIdOrAlias = alias || worldId || undefined;
  const homeWorldId = useHomeWorld();

  const rooms = useObservableMap(() => session.rooms, [session.rooms]);
  const roomsBeingCreated = useObservableMap(() => session.roomsBeingCreated, [session.roomsBeingCreated]);

  if (alias) {
    for (const room of rooms.values()) {
      if (room.canonicalAlias === alias) {
        return [worldIdOrAlias, room, reloadId];
      }
    }
  } else if (worldId) {
    const room = rooms.get(worldId);

    if (room) {
      return [worldIdOrAlias, room, reloadId];
    }

    const roomBeingCreated = roomsBeingCreated.get(worldId);

    return [worldIdOrAlias, roomBeingCreated, reloadId];
  } else if (isHome && homeWorldId) {
    const room = rooms.get(homeWorldId);

    if (room) {
      return [homeWorldId, room, reloadId];
    }

    const roomBeingCreated = roomsBeingCreated.get(homeWorldId);

    return [homeWorldId, roomBeingCreated, reloadId];
  }

  return [worldIdOrAlias, undefined, reloadId];
}
