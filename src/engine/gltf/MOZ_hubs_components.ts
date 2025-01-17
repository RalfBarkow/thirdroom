import { addComponent } from "bitecs";

import { createRemotePerspectiveCamera } from "../camera/camera.game";
import { SpawnPoint } from "../component/SpawnPoint";
import { Hidden, setQuaternionFromEuler, Transform } from "../component/transform";
import { GameState } from "../GameTypes";
import { addRemoteNodeComponent } from "../node/node.game";
import { GLTFRoot } from "./GLTF";
import { GLTFResource } from "./gltf.game";
import { addTrimesh } from "./OMI_collider";

export function hasHubsComponentsExtension(root: GLTFRoot) {
  return root.extensions?.MOZ_hubs_components !== undefined;
}

export function inflateHubsScene(ctx: GameState, resource: GLTFResource, sceneIndex: number, sceneEid: number) {}

export function inflateHubsNode(ctx: GameState, resource: GLTFResource, nodeIndex: number, nodeEid: number) {
  const node = resource.root.nodes![nodeIndex];
  const components = node.extensions?.MOZ_hubs_components;

  if (!components) {
    return;
  }

  if (components["spawn-point"] || components["waypoint"]?.canBeSpawnPoint) {
    Transform.position[nodeEid][1] += 1.6;
    Transform.rotation[nodeEid][1] += Math.PI;
    setQuaternionFromEuler(Transform.quaternion[nodeEid], Transform.rotation[nodeEid]);
    addComponent(ctx.world, SpawnPoint, nodeEid);
  }

  if (components["trimesh"] || components["nav-mesh"]) {
    addTrimesh(ctx, nodeEid);
  }

  if (components.visible?.visible === false) {
    addComponent(ctx.world, Hidden, nodeEid);
  }

  if (components["scene-preview-camera"]) {
    addRemoteNodeComponent(ctx, nodeEid, {
      camera: createRemotePerspectiveCamera(ctx),
    });
    ctx.activeCamera = nodeEid;
  }
}
