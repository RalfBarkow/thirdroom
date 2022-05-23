import * as RAPIER from "@dimforge/rapier3d-compat";
import { addEntity, createWorld, IWorld } from "bitecs";

import { addChild, addTransformComponent, registerTransformComponent, updateMatrixWorld } from "./component/transform";
import { createCursorBuffer } from "./allocator/CursorBuffer";
import { maxEntities, tickRate } from "./config.common";
import {
  RemoteResourceManager,
  createRemoteResourceManager,
  remoteResourceDisposed,
  remoteResourceLoaded,
  remoteResourceLoadError,
} from "./resources/RemoteResourceManager";
import { copyToWriteBuffer, getReadBufferIndex, swapWriteBuffer, TripleBufferState } from "./allocator/TripleBuffer";
import {
  InitializeGameWorkerMessage,
  WorkerMessages,
  WorkerMessageType,
  GameWorkerInitializedMessage,
  GameWorkerErrorMessage,
} from "./WorkerMessage";
import { ActionState, ActionMap } from "./input/ActionMappingSystem";
import { inputReadSystem } from "./input/inputReadSystem";
import { renderableBuffer } from "./component/buffers";
import { init, onStateChange } from "../game";
import { StatsBuffer } from "./stats/stats.common";
import { writeGameWorkerStats } from "./stats/stats.game";
import { exportGLTF } from "./gltf/exportGLTF";
import { createIncomingNetworkSystem, createOutgoingNetworkSystem } from "./network/network.game";
import { PrefabTemplate, registerDefaultPrefabs } from "./prefab";
import {
  EditorState,
  initEditor,
  initEditorState,
  onDisposeEditor,
  onEditorMessage,
  onLoadEditor,
} from "./editor/editor.game";
import { createRaycasterState, initRaycaster, RaycasterState } from "./raycaster/raycaster.game";
import { gameAudioSystem } from "./audio/audio.game";
import { createInputState, InputState, InputStateGetters } from "./input/input.common";
import { BaseThreadContext, registerModules, updateSystemOrder } from "./module/module.common";
import * as gameConfig from "./config.game";
// import { NetworkTransformSystem } from "./network";

const workerScope = globalThis as typeof globalThis & Worker;

async function onInitMessage({ data }: { data: WorkerMessages }) {
  if (typeof data !== "object") {
    return;
  }

  const message = data as WorkerMessages;

  if (message.type === WorkerMessageType.InitializeGameWorker) {
    workerScope.removeEventListener("message", onInitMessage);

    try {
      if (message.renderWorkerMessagePort) {
        message.renderWorkerMessagePort.start();
      }

      const state = await onInit(message);

      workerScope.addEventListener("message", onMessage(state));

      if (message.renderWorkerMessagePort) {
        message.renderWorkerMessagePort.addEventListener("message", onMessage(state));
      }

      await registerModules(state, gameConfig.modules);

      postMessage({
        type: WorkerMessageType.GameWorkerInitialized,
      } as GameWorkerInitializedMessage);
    } catch (error) {
      postMessage({
        type: WorkerMessageType.GameWorkerError,
        error,
      } as GameWorkerErrorMessage);
    }
  }
}

workerScope.addEventListener("message", onInitMessage);

const onMessage =
  (state: GameState) =>
  ({ data }: any) => {
    if (typeof data !== "object") {
      return;
    }

    const message = data as WorkerMessages;

    const handlers = state.messageHandlers.get(message.type);

    if (handlers) {
      for (let i = 0; i < handlers.length; i++) {
        handlers[i](state, message);
      }
      return;
    }

    // TODO: This switch statement is doing a lot of heavy lifting. Move to the message handler map above.
    switch (message.type) {
      case WorkerMessageType.StartGameWorker:
        onStart(state);
        break;

      // resource
      case WorkerMessageType.ResourceLoaded:
        remoteResourceLoaded(state.resourceManager, message.resourceId, message.remoteResource);
        break;
      case WorkerMessageType.ResourceLoadError:
        remoteResourceLoadError(state.resourceManager, message.resourceId, message.error);
        break;
      case WorkerMessageType.ResourceDisposed:
        remoteResourceDisposed(state.resourceManager, message.resourceId);
        break;

      case WorkerMessageType.ExportScene:
        exportGLTF(state, state.scene);
        break;

      case WorkerMessageType.StateChanged:
        onStateChange(state, message.state);
        break;

      // editor
      case WorkerMessageType.LoadEditor:
        onLoadEditor(state);
        break;
      case WorkerMessageType.DisposeEditor:
        onDisposeEditor(state);
        break;
      case WorkerMessageType.SetComponentProperty:
      case WorkerMessageType.RemoveComponent:
        onEditorMessage(state, message);
        break;
    }
  };

export type World = IWorld;

export interface TimeState {
  elapsed: number;
  dt: number;
}

export type RenderPort = MessagePort | (typeof globalThis & Worker);

export interface RenderState {
  tripleBuffer: TripleBufferState;
  port: RenderPort;
}

export interface GameInputState {
  tripleBuffer: TripleBufferState;
  inputStates: InputState[];
  actions: Map<string, ActionState>;
  actionMaps: ActionMap[];
  raw: { [path: string]: number };
}

export type System = (state: GameState) => void;

export interface GameState extends BaseThreadContext {
  world: World;
  physicsWorld: RAPIER.World;
  renderer: RenderState;
  time: TimeState;
  resourceManager: RemoteResourceManager;
  prefabTemplateMap: Map<string, PrefabTemplate>;
  entityPrefabMap: Map<number, string>;
  input: GameInputState;
  preSystems: System[];
  systems: System[];
  postSystems: System[];
  scene: number;
  camera: number;
  statsBuffer: StatsBuffer;
  editorState: EditorState;
  raycaster: RaycasterState;
  audio: { tripleBuffer: TripleBufferState };
}

const generateInputGetters = (
  inputStates: InputState[],
  inputTripleBuffer: TripleBufferState
): { [path: string]: number } =>
  Object.defineProperties(
    {},
    Object.fromEntries(
      Object.entries(InputStateGetters).map(([path, getter]) => [
        path,
        { enumerable: true, get: () => getter(inputStates[getReadBufferIndex(inputTripleBuffer)]) },
      ])
    )
  );

async function onInit({
  resourceManagerBuffer,
  renderWorkerMessagePort,
  renderableTripleBuffer,
  initialGameWorkerState,
}: InitializeGameWorkerMessage): Promise<GameState> {
  const { inputTripleBuffer, audioTripleBuffer, hierarchyTripleBuffer, statsBuffer } = initialGameWorkerState as {
    inputTripleBuffer: TripleBufferState;
    audioTripleBuffer: TripleBufferState;
    hierarchyTripleBuffer: TripleBufferState;
    statsBuffer: StatsBuffer;
  };

  const renderPort = renderWorkerMessagePort || workerScope;

  const world = createWorld<World>(maxEntities);

  // noop entity
  addEntity(world);

  const scene = addEntity(world);
  addTransformComponent(world, scene);

  const camera = addEntity(world);
  addTransformComponent(world, camera);
  addChild(scene, camera);

  await RAPIER.init();

  const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
  const physicsWorld = new RAPIER.World(gravity);

  const inputStates = inputTripleBuffer.buffers
    .map((buffer) => createCursorBuffer(buffer))
    .map((buffer) => createInputState(buffer));

  const resourceManager = createRemoteResourceManager(resourceManagerBuffer, renderPort);

  const renderer: RenderState = {
    tripleBuffer: renderableTripleBuffer,
    port: renderPort,
  };

  const input: GameInputState = {
    tripleBuffer: inputTripleBuffer,
    inputStates,
    actions: new Map(),
    actionMaps: [],
    raw: generateInputGetters(inputStates, inputTripleBuffer),
  };

  const time: TimeState = {
    elapsed: performance.now(),
    dt: 0,
  };

  const audio = {
    tripleBuffer: audioTripleBuffer,
  };

  const state: GameState = {
    world,
    scene,
    camera,
    resourceManager,
    prefabTemplateMap: new Map(),
    entityPrefabMap: new Map(),
    renderer,
    physicsWorld,
    audio,
    input,
    time,
    systemGraphChanged: true,
    systemGraph: [],
    systems: [],
    preSystems: [],
    postSystems: [],
    statsBuffer,
    editorState: initEditorState(hierarchyTripleBuffer),
    raycaster: createRaycasterState(),
    messageHandlers: new Map(),
    scopes: new Map(),
  };

  initRaycaster(state);
  initEditor(state);

  registerDefaultPrefabs(state);

  // TODO: Register components in some other file.
  registerTransformComponent(state);

  state.preSystems.push(createIncomingNetworkSystem(state));

  state.postSystems.push(createOutgoingNetworkSystem(state));
  // state.postSystems.push(NetworkTransformSystem, createOutgoingNetworkSystem(state));

  await init(state);

  return state;
}

function onStart(state: GameState) {
  update(state);
}

const updateWorldMatrixSystem = (state: GameState) => {
  updateMatrixWorld(state.scene);
};

const renderableTripleBufferSystem = ({ renderer }: GameState) => {
  copyToWriteBuffer(renderer.tripleBuffer, renderableBuffer);
  swapWriteBuffer(renderer.tripleBuffer);
};

const timeSystem = ({ time }: GameState) => {
  const now = performance.now();
  time.dt = (now - time.elapsed) / 1000;
  time.elapsed = now;
};

const pipeline = (state: GameState) => {
  timeSystem(state);
  inputReadSystem(state);

  for (let i = 0; i < state.preSystems.length; i++) {
    state.preSystems[i](state);
  }

  const systems = updateSystemOrder(state);

  for (let i = 0; i < systems.length; i++) {
    systems[i](state);
  }

  for (let i = 0; i < state.postSystems.length; i++) {
    state.postSystems[i](state);
  }

  updateWorldMatrixSystem(state);
  renderableTripleBufferSystem(state);
  gameAudioSystem(state);
};

// timeoutOffset: ms to subtract from the dynamic timeout to make sure we are always updating around 60hz
// ex. Our game loop should be called every 16.666ms, it took 3ms this frame.
// We could schedule the timeout for 13.666ms, but it would likely be scheduled about  3ms later.
// So subtract 3-4ms from that timeout to make sure it always swaps the buffers in under 16.666ms.
const timeoutOffset = 4;

function update(state: GameState) {
  pipeline(state);

  const frameDuration = performance.now() - state.time.elapsed;
  const remainder = Math.max(1000 / tickRate - frameDuration - timeoutOffset, 0);

  writeGameWorkerStats(state, frameDuration);

  setTimeout(() => update(state), remainder);
}
