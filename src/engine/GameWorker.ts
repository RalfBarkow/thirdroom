import * as RAPIER from "@dimforge/rapier3d-compat";
import { createWorld, IWorld } from "bitecs";
import { mat4 } from "gl-matrix";

import { Transform } from "./component/transform";
import { createCursorBuffer } from "./allocator/CursorBuffer";
import { maxEntities, tickRate } from "./config";
import {
  registerRemoteResourceLoader,
  RemoteResourceManager,
  createRemoteResourceManager,
} from "./resources/RemoteResourceManager";
import { GLTFRemoteResourceLoader } from "./resources/GLTFResourceLoader";
import { MeshRemoteResourceLoader } from "./resources/MeshResourceLoader";
import { copyToWriteBuffer, getReadBufferIndex, swapWriteBuffer, TripleBufferState } from "./TripleBuffer";
import { createInputState, getInputButtonPressed, InputState } from "./input/InputManager";
import { InputArray, InputObjectType } from "./input/InputKeys";
import { MaterialRemoteResourceLoader } from "./resources/MaterialResourceLoader";
import { createRemoteGeometry, GeometryRemoteResourceLoader, GeometryType } from "./resources/GeometryResourceLoader";
import {
  InitializeGameWorkerMessage,
  WorkerMessages,
  WorkerMessageType,
  GameWorkerInitializedMessage,
  GameWorkerErrorMessage,
} from "./WorkerMessage";
import { createCube } from "./prefab";
import { inputReadSystem } from "./input/inputReadSystem";
import { physicsSystem } from "./physics";
import { renderableBuffer } from "./component";
import { CameraRemoteResourceLoader } from "./resources/CameraResourceLoader";

const workerScope = globalThis as typeof globalThis & Worker;

const onMessage =
  (state: World) =>
  ({ data }: any) => {
    if (typeof data !== "object") {
      return;
    }

    // const message = data as WorkerMessages;

    // todo: messages
  };

async function onInitMessage({ data }: { data: WorkerMessages }) {
  if (typeof data !== "object") {
    return;
  }

  const message = data as WorkerMessages;

  if (message.type === WorkerMessageType.InitializeGameWorker) {
    try {
      if (message.renderWorkerMessagePort) {
        message.renderWorkerMessagePort.start();
      }

      const state = await onInit(message);

      postMessage({
        type: WorkerMessageType.GameWorkerInitialized,
      } as GameWorkerInitializedMessage);

      workerScope.addEventListener("message", onMessage(state));

      if (message.renderWorkerMessagePort) {
        message.renderWorkerMessagePort.addEventListener("message", onMessage(state));
      }
    } catch (error) {
      postMessage({
        type: WorkerMessageType.GameWorkerError,
        error,
      } as GameWorkerErrorMessage);
    }

    workerScope.removeEventListener("message", onInitMessage);
  }
}

workerScope.addEventListener("message", onInitMessage);

export interface TimeState {
  then: number;
  delta: number;
}

export interface PhysicsState {
  world: RAPIER.World;
  objects: RAPIER.RigidBody[];
}

export type World = IWorld;

export type RenderPort = MessagePort | (typeof globalThis & Worker);

export interface RenderState {
  tripleBuffer: TripleBufferState;
  port: RenderPort;
}

export interface GameInputState extends InputObjectType {
  tripleBuffer: TripleBufferState;
  inputStates: InputState[];
}

export interface GameState {
  world: World;
  physics: PhysicsState;
  renderer: RenderState;
  time: TimeState;
  resourceManager: RemoteResourceManager;
  input: GameInputState;
}

const generateInputGetters = (inputStates: InputState[], inputTripleBuffer: TripleBufferState): InputObjectType =>
  InputArray.reduce(
    (a, v, i) =>
      Object.defineProperty(a, v, {
        enumerable: true,
        get: () => getInputButtonPressed(inputStates[getReadBufferIndex(inputTripleBuffer)], i),
      }),
    {}
  ) as InputObjectType;

async function onInit({
  inputTripleBuffer,
  resourceManagerBuffer,
  renderWorkerMessagePort,
  renderableTripleBuffer,
}: InitializeGameWorkerMessage): Promise<GameState> {
  const renderPort = renderWorkerMessagePort || workerScope;

  const world = createWorld<World>(maxEntities);

  await RAPIER.init();

  const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
  const physicsWorld = new RAPIER.World(gravity);

  // Create the ground
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(100.0, 0.1, 100.0);
  physicsWorld.createCollider(groundColliderDesc);

  const inputStates = inputTripleBuffer.buffers
    .map((buffer) => createCursorBuffer(buffer))
    .map((buffer) => createInputState(buffer));

  const resourceManager = createRemoteResourceManager(resourceManagerBuffer, renderPort);

  registerRemoteResourceLoader(resourceManager, GeometryRemoteResourceLoader);
  registerRemoteResourceLoader(resourceManager, MaterialRemoteResourceLoader);
  registerRemoteResourceLoader(resourceManager, MeshRemoteResourceLoader);
  registerRemoteResourceLoader(resourceManager, CameraRemoteResourceLoader);
  registerRemoteResourceLoader(resourceManager, GLTFRemoteResourceLoader);

  const physics: PhysicsState = {
    world: physicsWorld,
    objects: Array(maxEntities),
  };

  const renderer: RenderState = {
    tripleBuffer: renderableTripleBuffer,
    port: renderPort,
  };

  const input: GameInputState = {
    tripleBuffer: inputTripleBuffer,
    inputStates,
    ...generateInputGetters(inputStates, inputTripleBuffer),
  };

  const time: TimeState = {
    then: performance.now(),
    delta: 0,
  };

  // TODO: Add scene/camera entities using resource ids from the render thread

  const state: GameState = {
    world,
    resourceManager,
    renderer,
    physics,
    input,
    time,
  };

  console.log("GameWorker initialized");

  const geometryResourceId = createRemoteGeometry(resourceManager, {
    type: "geometry",
    geometryType: GeometryType.Box,
  });

  for (let i = 0; i < maxEntities; i++) {
    createCube(state, geometryResourceId);
  }

  update(state);
  console.log("GameWorker loop started");

  // TODO send message to main thread that initialization is finished

  return state;
}

// TODO start game thread loop when receiving start message

const speed = 0.5;
const forward = new RAPIER.Vector3(0, 0, -speed);
const backward = new RAPIER.Vector3(0, 0, speed);
const right = new RAPIER.Vector3(speed, 0, 0);
const left = new RAPIER.Vector3(-speed, 0, 0);
const up = new RAPIER.Vector3(0, speed, 0);
const cubeMoveSystem = ({ input, physics }: GameState) => {
  const eid = 1;
  const rigidBody = physics.objects[eid];
  if (input.KeyW) {
    rigidBody.applyImpulse(forward, true);
  }
  if (input.KeyS) {
    rigidBody.applyImpulse(backward, true);
  }
  if (input.KeyA) {
    rigidBody.applyImpulse(left, true);
  }
  if (input.KeyD) {
    rigidBody.applyImpulse(right, true);
  }
  if (input.Space) {
    rigidBody.applyImpulse(up, true);
  }
};

const cameraMoveSystem = ({ input, time: { delta } }: GameState) => {
  const eid = 0;
  const position = Transform.position[eid];
  if (input.ArrowUp) {
    position[2] -= delta * 25;
  }
  if (input.ArrowDown) {
    position[2] += delta * 25;
  }
  if (input.ArrowLeft) {
    position[0] -= delta * 25;
  }
  if (input.ArrowRight) {
    position[0] += delta * 25;
  }
};

const updateWorldMatrixSystem = () => {
  for (let i = 0; i < maxEntities; i++) {
    const position = Transform.position[i];
    const quaternion = Transform.quaternion[i];
    const scale = Transform.scale[i];
    mat4.fromRotationTranslationScale(Transform.worldMatrix[i], quaternion, position, scale);
  }
};

const renderableTripleBufferSystem = ({ renderer }: GameState) => {
  copyToWriteBuffer(renderer.tripleBuffer, renderableBuffer);
  swapWriteBuffer(renderer.tripleBuffer);
};

const timeSystem = ({ time }: GameState) => {
  const now = performance.now();
  time.delta = (now - time.then) / 1000;
  time.then = now;
};

const pipeline = (state: GameState) => {
  timeSystem(state);
  inputReadSystem(state);
  cameraMoveSystem(state);
  cubeMoveSystem(state);
  physicsSystem(state);
  updateWorldMatrixSystem();
  renderableTripleBufferSystem(state);
};

function update(state: GameState) {
  pipeline(state);

  const elapsed = performance.now() - state.time.then;
  const remainder = 1000 / tickRate - elapsed;

  if (remainder > 0) {
    // todo: call fixed timestep physics pipeline here
    setTimeout(() => update(state), remainder);
  } else {
    update(state);
  }
}
